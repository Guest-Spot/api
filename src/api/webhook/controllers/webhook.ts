/**
 * Stripe webhook controller
 * Handles both booking and tip payment webhook events
 * Routes events to appropriate handlers based on metadata
 */

import { verifyWebhookSignature, isAccountOnboarded, isStripeEnabled } from '../../../utils/stripe';
import { sendFirebaseNotificationToUser } from '../../../utils/push-notification';
import Stripe from 'stripe';
import { NotifyType } from '../../../interfaces/enums';
import {
  handleBookingCheckoutSessionCompleted,
  handleBookingPaymentIntentAuthorized,
  handleBookingPaymentIntentSucceeded,
  handleBookingPaymentIntentFailed,
  handleBookingPaymentIntentCanceled,
} from '../../booking/services/webhook';
import {
  handleTipCheckoutSessionCompleted,
  handleCheckoutSessionAsyncPaymentSucceeded,
  handleCheckoutSessionAsyncPaymentFailed,
  handleTipPaymentIntentSucceeded,
  handleTipPaymentIntentFailed,
  handleTipPaymentIntentCanceled,
} from '../../tip/services/webhook';
import {
  handleGuestSpotCheckoutSessionCompleted,
  handleGuestSpotPaymentIntentSucceeded,
  handleGuestSpotPaymentIntentCanceled,
} from '../../guest-spot-booking/services/guest-spot-webhook';

export default {
  /**
   * Handle Stripe webhook events
   * POST /api/webhooks/stripe
   */
  async handleStripeWebhook(ctx) {
    // Check if Stripe is enabled
    const stripeEnabled = await isStripeEnabled();
    if (!stripeEnabled) {
      strapi.log.warn('Stripe is disabled, ignoring webhook event');
      return ctx.badRequest('Stripe payments are disabled');
    }

    const sig = ctx.request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    strapi.log.debug('Webhook request received');

    if (!webhookSecret) {
      strapi.log.error('STRIPE_WEBHOOK_SECRET is not configured in Settings or environment variable');
      return ctx.badRequest('Webhook secret not configured');
    }

    if (!sig) {
      strapi.log.error('Missing stripe-signature header');
      return ctx.badRequest('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Get raw body for signature verification
      const rawBody = ctx.request.body[Symbol.for('unparsedBody')];
      
      if (!rawBody) {
        strapi.log.error('Missing raw body - make sure includeUnparsed is enabled in middlewares config');
        return ctx.badRequest('Missing raw body');
      }

      strapi.log.debug('Raw body received, verifying signature...');

      // Verify webhook signature
      event = await verifyWebhookSignature(rawBody, sig, webhookSecret);
      
      strapi.log.debug('Signature verified successfully');
    } catch (error) {
      strapi.log.error('Webhook signature verification failed:', error);
      return ctx.badRequest('Invalid signature');
    }

    strapi.log.info(`Received Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.async_payment_succeeded':
          await handleCheckoutSessionAsyncPaymentSucceeded(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.async_payment_failed':
          await handleCheckoutSessionAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.amount_capturable_updated':
          // Payment authorized but not yet captured (only for bookings)
          await handlePaymentIntentAuthorized(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.succeeded':
          // Payment captured successfully
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          // Payment failed
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          // Payment cancelled
          await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        case 'account.updated':
          // Stripe Connect account updated
          await handleAccountUpdated(event.data.object as Stripe.Account);
          break;

        default:
          strapi.log.info(`Unhandled webhook event type: ${event.type}`);
      }

      ctx.send({ received: true });
    } catch (error) {
      strapi.log.error('Error processing webhook:', error);
      ctx.badRequest('Error processing webhook');
    }
  },
};

/**
 * Handle checkout.session.completed event
 * Routes to booking, tip, or guest spot handler based on metadata
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.type === 'guest_spot_deposit') {
    await handleGuestSpotCheckoutSessionCompleted(session);
    return;
  }
  if (session.metadata?.type === 'tip' || session.metadata?.tipDocumentId) {
    await handleTipCheckoutSessionCompleted(session);
    return;
  }
  await handleBookingCheckoutSessionCompleted(session);
}

/**
 * Handle payment_intent.amount_capturable_updated event
 * Payment is authorized (funds on hold) - only for bookings
 */
async function handlePaymentIntentAuthorized(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata?.tipDocumentId) {
    strapi.log.debug('Ignoring payment intent authorization for tips');
    return;
  }
  if (paymentIntent.metadata?.type === 'guest_spot_deposit') {
    strapi.log.debug('Guest spot uses checkout.session.completed for authorize');
    return;
  }
  await handleBookingPaymentIntentAuthorized(paymentIntent);
}

/**
 * Handle payment_intent.succeeded event
 * Payment captured successfully - routes to booking, tip, or guest spot handler
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata?.tipDocumentId) {
    await handleTipPaymentIntentSucceeded(paymentIntent);
    return;
  }
  if (paymentIntent.metadata?.type === 'guest_spot_deposit') {
    await handleGuestSpotPaymentIntentSucceeded(paymentIntent);
    return;
  }
  await handleBookingPaymentIntentSucceeded(paymentIntent);
}

/**
 * Handle payment_intent.payment_failed event
 * Payment failed - routes to booking or tip handler
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Route tip events to tip handler
  if (paymentIntent.metadata?.tipDocumentId) {
    await handleTipPaymentIntentFailed(paymentIntent);
    return;
  }

  // Handle booking events
  await handleBookingPaymentIntentFailed(paymentIntent);
}

/**
 * Handle payment_intent.canceled event
 * Payment cancelled - routes to booking, tip, or guest spot handler
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata?.tipDocumentId) {
    await handleTipPaymentIntentCanceled(paymentIntent);
    return;
  }
  if (paymentIntent.metadata?.type === 'guest_spot_deposit') {
    await handleGuestSpotPaymentIntentCanceled(paymentIntent);
    return;
  }
  await handleBookingPaymentIntentCanceled(paymentIntent);
}

/**
 * Handle account.updated event
 * Updates user's payoutsEnabled status when Stripe Connect account is updated
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const accountId = account.id;

  strapi.log.info(`Processing account.updated for ${accountId}`);

  try {
    // Find user with this Stripe account
    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: { stripeAccountID: accountId },
    });

    if (users.length === 0) {
      strapi.log.warn(`No user found for Stripe account ${accountId}`);
      return;
    }

    const user = users[0];
    const onboarded = isAccountOnboarded(account);

    strapi.log.info(
      `Account ${accountId} status: onboarded=${onboarded}, payouts=${account.payouts_enabled}, charges=${account.charges_enabled}, details=${account.details_submitted}`
    );

    // Update user's payoutsEnabled status if changed
    if (user.payoutsEnabled !== onboarded) {
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: user.documentId,
        data: {
          payoutsEnabled: onboarded,
        },
        status: 'published',
      });

      strapi.log.info(
        `Updated payoutsEnabled to ${onboarded} for user ${user.id} (${user.email})`
      );

      // Send notification to artist
      if (onboarded) {
        try {
          await sendFirebaseNotificationToUser(user.id, {
            title: 'Stripe Account Activated',
            body: 'Your Stripe account is now active! You can start receiving payments.',
            data: {
              accountId,
              type: NotifyType.STRIPE_ACCOUNT_ACTIVATED,
            },
          });
        } catch (notifError) {
          strapi.log.error('Error sending notification:', notifError);
        }
      }
    }
  } catch (error) {
    strapi.log.error(`Error processing account.updated for ${accountId}:`, error);
  }
}
