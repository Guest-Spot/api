import Stripe from 'stripe';

export const STRIPE_FEE_PERCENT = 2.9;

// Cached Stripe client instance
let stripeClient: Stripe | null = null;

/**
 * Get Stripe secret key from Settings (singleType)
 */
export const getStripeSecretKey = async (): Promise<string> => {
  try {
    // Fetch setting from database
    const setting = await strapi.query('api::setting.setting').findOne({});

    const secretKey = setting?.stripeSecretKey;
    
    if (!secretKey || typeof secretKey !== 'string' || secretKey.trim() === '') {
      strapi.log.warn('Stripe secret key not configured in Settings, falling back to environment variable');
      return process.env.STRIPE_SECRET_KEY || '';
    }

    return secretKey;
  } catch (error) {
    strapi.log.error('Error fetching Stripe secret key from Settings:', error);
    return process.env.STRIPE_SECRET_KEY || '';
  }
};

/**
 * Get Stripe webhook secret from Settings (singleType)
 */
export const getStripeWebhookSecret = async (): Promise<string> => {
  try {
    // Fetch setting from database
    const setting = await strapi.query('api::setting.setting').findOne({});

    const webhookSecret = setting?.stripeWebhookSecret;
    
    if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim() === '') {
      strapi.log.warn('Stripe webhook secret not configured in Settings, falling back to environment variable');
      return process.env.STRIPE_WEBHOOK_SECRET || '';
    }

    return webhookSecret;
  } catch (error) {
    strapi.log.error('Error fetching Stripe webhook secret from Settings:', error);
    return process.env.STRIPE_WEBHOOK_SECRET || '';
  }
};

/**
 * Get or create Stripe client instance
 * Initializes client lazily with secret key from Settings
 */
export const getStripeClient = async (): Promise<Stripe> => {
  if (!stripeClient) {
    const secretKey = await getStripeSecretKey();
    
    if (!secretKey || secretKey.trim() === '') {
      throw new Error('Stripe secret key is not configured. Please set it in Settings or STRIPE_SECRET_KEY environment variable.');
    }
    
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-09-30.clover',
    });
  }
  
  return stripeClient;
};

/**
 * Calculate platform fee based on amount and percentage
 */
export const calculatePlatformFee = (amount: number, percent: number): number => {
  return Math.round((amount * percent) / 100);
};

/**
 * Get platform fee percentage from Settings (singleType)
 */
export const getPlatformFeePercent = async (): Promise<number> => {
  try {
    // Fetch setting from database
    const setting = await strapi.query('api::setting.setting').findOne({});

    const percent = setting?.platformFeePercent;
    
    if (percent === undefined || percent === null) {
      strapi.log.warn('Platform fee percent not configured in Settings, using default: 0%');
      return 0;
    }

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new Error(`Invalid platform fee percent in Settings: ${percent}`);
    }

    return percent;
  } catch (error) {
    return 0;
  }
};

/**
 * Check if Stripe is enabled in Settings (singleType)
 */
export const isStripeEnabled = async (): Promise<boolean> => {
  try {
    // Fetch setting from database
    const setting = await strapi.query('api::setting.setting').findOne({});
    return setting?.stripeEnabled === true;
  } catch (error) {
    strapi.log.error('Error checking Stripe enabled status:', error);
    return false;
  }
};

/**
 * Get default currency from environment variable
 */
export const getDefaultCurrency = (): string => {
  return (process.env.DEFAULT_CURRENCY || 'usd').toLowerCase();
};

/**
 * Create a Checkout Session with pre-authorization (manual capture)
 * Uses Stripe Connect to transfer funds to artist's account
 */
export const createCheckoutSession = async (params: {
  bookingId: string | number;
  amount: number;
  currency: string;
  platformFee: number;
  artistStripeAccountId: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> => {
  const { bookingId, amount, currency, platformFee, artistStripeAccountId, customerEmail, metadata = {} } = params;

  const stripe = await getStripeClient();
  const settings = await strapi.query('api::setting.setting').findOne({});
  const successUrl = settings?.stripeSuccessUrl;
  const cancelUrl = settings?.stripeCancelUrl;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(customerEmail && { customer_email: customerEmail }),
    payment_intent_data: {
      // Manual capture for pre-authorization
      capture_method: 'manual',
      // Application fee goes to platform (deducted from transfer amount)
      application_fee_amount: platformFee,
      // Transfer remaining amount to artist's Stripe Connect account
      transfer_data: {
        destination: artistStripeAccountId,
      },
      metadata: {
        bookingId: bookingId.toString(),
        ...metadata,
      },
    },
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: 'Tattoo Booking',
            description: `Booking #${bookingId}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl || process.env.STRIPE_SUCCESS_URL,
    cancel_url: cancelUrl || process.env.STRIPE_CANCEL_URL,
    metadata: {
      bookingId: bookingId.toString(),
      ...metadata,
    },
  });

  return session;
};

/**
 * Capture a pre-authorized payment (when artist accepts booking)
 */
export const capturePaymentIntent = async (paymentIntentId: string): Promise<Stripe.PaymentIntent> => {
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Error capturing payment intent:', error);
    throw error;
  }
};

/**
 * Cancel a pre-authorized payment (when artist rejects booking or timeout)
 */
export const cancelPaymentIntent = async (paymentIntentId: string): Promise<Stripe.PaymentIntent> => {
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Error cancelling payment intent:', error);
    throw error;
  }
};

/**
 * Verify webhook signature from Stripe
 */
export const verifyWebhookSignature = async (
  payload: string | Buffer,
  signature: string,
  secret: string
): Promise<Stripe.Event> => {
  try {
    const stripe = await getStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
};

/**
 * Retrieve a Checkout Session by ID
 */
export const getCheckoutSession = async (sessionId: string): Promise<Stripe.Checkout.Session> => {
  try {
    const stripe = await getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    return session;
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    throw error;
  }
};

/**
 * Retrieve a Payment Intent by ID
 */
export const getPaymentIntent = async (paymentIntentId: string): Promise<Stripe.PaymentIntent> => {
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    throw error;
  }
};

/**
 * Create a Stripe Connect Account for an artist with optional prefilled data
 */
export const createConnectAccount = async (params: {
  email: string;
  type?: 'express' | 'standard';
  country?: string;
  // Optional prefill data to reduce onboarding friction
  firstName?: string;
  lastName?: string;
  phone?: string;
  dob?: { day?: number; month?: number; year?: number };
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
}): Promise<Stripe.Account> => {
  const { 
    email, 
    type = 'express', 
    country = 'US',
    firstName,
    lastName,
    phone,
    dob,
    address,
  } = params;

  try {
    const accountData: Stripe.AccountCreateParams = {
      type,
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
    };

    // Prefill individual data if provided (reduces onboarding friction)
    if (firstName || lastName || phone || dob || address) {
      accountData.individual = {};
      
      if (firstName) accountData.individual.first_name = firstName;
      if (lastName) accountData.individual.last_name = lastName;
      if (phone) accountData.individual.phone = phone;
      // Only set dob if all required fields are present
      if (dob && dob.day && dob.month && dob.year) {
        accountData.individual.dob = {
          day: dob.day,
          month: dob.month,
          year: dob.year,
        };
      }
      if (address) accountData.individual.address = address;
    }

    const stripe = await getStripeClient();
    const account = await stripe.accounts.create(accountData);

    strapi.log.info(`Created Stripe Connect account ${account.id} for ${email}${firstName ? ` (${firstName} ${lastName})` : ''}`);
    return account;
  } catch (error) {
    strapi.log.error('Error creating Stripe Connect account:', error);
    throw error;
  }
};

/**
 * Create an Account Link for onboarding
 * This URL will redirect the artist to Stripe to complete their account setup
 */
export const createAccountLink = async (params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  type?: 'account_onboarding' | 'account_update';
}): Promise<Stripe.AccountLink> => {
  const { accountId, refreshUrl, returnUrl, type = 'account_onboarding' } = params;

  try {
    const stripe = await getStripeClient();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
    });

    strapi.log.info(`Created account link for ${accountId}, expires at ${accountLink.expires_at}`);
    return accountLink;
  } catch (error) {
    strapi.log.error('Error creating account link:', error);
    throw error;
  }
};

/**
 * Retrieve account details to check onboarding status
 */
export const getConnectAccount = async (accountId: string): Promise<Stripe.Account> => {
  try {
    const stripe = await getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    return account;
  } catch (error) {
    strapi.log.error('Error retrieving Stripe account:', error);
    throw error;
  }
};

/**
 * Check if account is fully onboarded and can receive payouts
 */
export const isAccountOnboarded = (account: Stripe.Account): boolean => {
  return (
    account.details_submitted === true &&
    account.payouts_enabled === true &&
    account.charges_enabled === true
  );
};

/**
 * Create a Login Link for Express Dashboard
 * This allows artists to access a simplified Stripe dashboard to add bank account details
 */
export const createLoginLink = async (accountId: string): Promise<Stripe.LoginLink> => {
  try {
    const stripe = await getStripeClient();
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    strapi.log.info(`Created login link for account ${accountId}`);
    return loginLink;
  } catch (error) {
    strapi.log.error('Error creating login link:', error);
    throw error;
  }
};

/**
 * Add external bank account to Connect account
 */
export const addExternalAccount = async (params: {
  accountId: string;
  country: string;
  currency: string;
  accountNumber?: string;
  routingNumber?: string;
  accountHolderName?: string;
  accountHolderType?: 'individual' | 'company';
}): Promise<Stripe.BankAccount> => {
  const {
    accountId,
    country,
    currency,
    accountNumber,
    routingNumber,
    accountHolderName,
    accountHolderType = 'individual',
  } = params;

  try {
    const stripe = await getStripeClient();
    const externalAccount = await stripe.accounts.createExternalAccount(accountId, {
      external_account: {
        object: 'bank_account',
        country,
        currency,
        account_number: accountNumber,
        routing_number: routingNumber,
        account_holder_name: accountHolderName,
        account_holder_type: accountHolderType,
      },
    });

    strapi.log.info(`Added external account to ${accountId}`);
    return externalAccount as Stripe.BankAccount;
  } catch (error) {
    strapi.log.error('Error adding external account:', error);
    throw error;
  }
};

// Export default for backward compatibility (returns cached client or creates new one)
export default getStripeClient;
