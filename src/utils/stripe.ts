import Stripe from 'stripe';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

/**
 * Calculate platform fee based on amount and percentage
 */
export const calculatePlatformFee = (amount: number, percent: number): number => {
  return Math.round((amount * percent) / 100);
};

/**
 * Get platform fee percentage from environment variable
 */
export const getPlatformFeePercent = (): number => {
  const percent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '10');
  if (isNaN(percent) || percent < 0 || percent > 100) {
    throw new Error('Invalid STRIPE_PLATFORM_FEE_PERCENT in environment variables');
  }
  return percent;
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
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> => {
  const { bookingId, amount, currency, platformFee, artistStripeAccountId, metadata = {} } = params;

  // Calculate transfer amount (total - platform fee)
  const transferAmount = amount - platformFee;

  if (transferAmount <= 0) {
    throw new Error('Transfer amount must be greater than 0');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_intent_data: {
      // Manual capture for pre-authorization
      capture_method: 'manual',
      // Application fee goes to platform
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
    success_url: process.env.STRIPE_SUCCESS_URL || `${process.env.PUBLIC_URL}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: process.env.STRIPE_CANCEL_URL || `${process.env.PUBLIC_URL}/booking-cancelled`,
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
export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event => {
  try {
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

export default stripe;
