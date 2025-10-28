/**
 * Stripe webhook controller
 */

import { verifyWebhookSignature, isAccountOnboarded } from '../../../utils/stripe';
import { sendPaymentSuccessEmail } from '../../../utils/email/payment-success';
import Stripe from 'stripe';
import { BookingWithRelations } from '../types/booking-populated';

export default {
  /**
   * Handle Stripe webhook events
   * POST /api/webhooks/stripe
   */
  async handleStripeWebhook(ctx) {
    const sig = ctx.request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      strapi.log.error('STRIPE_WEBHOOK_SECRET is not configured');
      return ctx.badRequest('Webhook secret not configured');
    }

    if (!sig) {
      return ctx.badRequest('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Get raw body for signature verification
      const rawBody = ctx.request.body[Symbol.for('unparsedBody')];
      
      if (!rawBody) {
        return ctx.badRequest('Missing raw body');
      }

      // Verify webhook signature
      event = verifyWebhookSignature(rawBody, sig, webhookSecret);
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

        case 'payment_intent.amount_capturable_updated':
          // Payment authorized but not yet captured
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
 * Updates booking with payment intent ID
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;
  const paymentIntentId = session.payment_intent as string;

  if (!bookingId) {
    strapi.log.error('No bookingId in session metadata');
    return;
  }

  strapi.log.info(`Checkout session completed for booking ${bookingId}, payment intent: ${paymentIntentId}`);

  // Find booking
  const booking = await strapi.entityService.findOne('api::booking.booking', bookingId, {
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingId} not found`);
    return;
  }

  // Update booking with payment intent ID
  await strapi.entityService.update('api::booking.booking', bookingId, {
    data: {
      stripePaymentIntentId: paymentIntentId,
    },
  });
}

/**
 * Handle payment_intent.amount_capturable_updated event
 * Payment is authorized (funds on hold)
 */
async function handlePaymentIntentAuthorized(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    strapi.log.error('No bookingId in payment intent metadata');
    return;
  }

  strapi.log.info(`Payment authorized for booking ${bookingId}`);

  // Find booking
  const booking = await strapi.entityService.findOne('api::booking.booking', bookingId, {
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingId} not found`);
    return;
  }

  // Update payment status to authorized
  await strapi.entityService.update('api::booking.booking', bookingId, {
    data: {
      paymentStatus: 'authorized',
      stripePaymentIntentId: paymentIntent.id,
      authorizedAt: new Date().toISOString(),
    },
  });

  // Send notification to artist about new paid booking request
  try {
    await strapi.plugin('users-permissions').service('user').sendNotification({
      userId: booking.artist.id,
      type: 'booking_created',
      message: `New booking request from ${booking.owner.username} (Payment authorized)`,
      data: {
        bookingId: booking.id,
      },
    });
  } catch (error) {
    strapi.log.error('Error sending notification:', error);
  }
}

/**
 * Handle payment_intent.succeeded event
 * Payment captured successfully (artist accepted)
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    strapi.log.error('No bookingId in payment intent metadata');
    return;
  }

  strapi.log.info(`Payment succeeded for booking ${bookingId}`);

  // Find booking
  const booking = await strapi.entityService.findOne('api::booking.booking', bookingId, {
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingId} not found`);
    return;
  }

  // Update payment status to paid
  await strapi.entityService.update('api::booking.booking', bookingId, {
    data: {
      paymentStatus: 'paid',
    },
  });

  // Send email and push notifications to both parties
  try {
    // Send email to owner (guest)
    await sendPaymentSuccessEmail({
      userName: booking.owner.username,
      userEmail: booking.owner.email,
      artistName: booking.artist.username,
      bookingId: booking.id,
      amount: booking.amount,
      currency: booking.currency,
      isArtist: false,
    });

    // Send email to artist
    await sendPaymentSuccessEmail({
      userName: booking.artist.username,
      userEmail: booking.artist.email,
      artistName: booking.artist.username,
      bookingId: booking.id,
      amount: booking.amount,
      currency: booking.currency,
      isArtist: true,
    });

    // Send push notifications if available
    try {
      await strapi.plugin('users-permissions').service('user').sendNotification({
        userId: booking.owner.id,
        type: 'payment_succeeded',
        message: `Payment processed successfully for your booking`,
        data: {
          bookingId: booking.id,
        },
      });

      await strapi.plugin('users-permissions').service('user').sendNotification({
        userId: booking.artist.id,
        type: 'payment_succeeded',
        message: `Payment received for booking from ${booking.owner.username}`,
        data: {
          bookingId: booking.id,
        },
      });
    } catch (pushError) {
      strapi.log.error('Error sending push notifications:', pushError);
    }
  } catch (error) {
    strapi.log.error('Error sending notifications:', error);
  }
}

/**
 * Handle payment_intent.payment_failed event
 * Payment failed
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    strapi.log.error('No bookingId in payment intent metadata');
    return;
  }

  strapi.log.error(`Payment failed for booking ${bookingId}`);

  // Find booking
  const booking = await strapi.entityService.findOne('api::booking.booking', bookingId, {
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingId} not found`);
    return;
  }

  // Update payment status to failed
  await strapi.entityService.update('api::booking.booking', bookingId, {
    data: {
      paymentStatus: 'failed',
    },
  });

  // Notify owner about failed payment
  try {
    await strapi.plugin('users-permissions').service('user').sendNotification({
      userId: booking.owner.id,
      type: 'payment_failed',
      message: `Payment failed for your booking. Please try again.`,
      data: {
        bookingId: booking.id,
      },
    });
  } catch (error) {
    strapi.log.error('Error sending notification:', error);
  }
}

/**
 * Handle payment_intent.canceled event
 * Payment cancelled (artist rejected or timeout)
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    strapi.log.error('No bookingId in payment intent metadata');
    return;
  }

  strapi.log.info(`Payment cancelled for booking ${bookingId}`);

  // Find booking
  const booking = await strapi.entityService.findOne('api::booking.booking', bookingId, {
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingId} not found`);
    return;
  }

  // Update payment status to cancelled
  await strapi.entityService.update('api::booking.booking', bookingId, {
    data: {
      paymentStatus: 'cancelled',
    },
  });

  // Notify owner about cancelled payment
  try {
    await strapi.plugin('users-permissions').service('user').sendNotification({
      userId: booking.owner.id,
      type: 'payment_cancelled',
      message: `Payment cancelled for your booking. Funds have been released.`,
      data: {
        bookingId: booking.id,
      },
    });
  } catch (error) {
    strapi.log.error('Error sending notification:', error);
  }
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
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          payoutsEnabled: onboarded,
        },
      });

      strapi.log.info(
        `Updated payoutsEnabled to ${onboarded} for user ${user.id} (${user.email})`
      );

      // Send notification to artist
      if (onboarded) {
        try {
          await strapi.plugin('users-permissions').service('user').sendNotification({
            userId: user.id,
            type: 'stripe_account_activated',
            message: 'Your Stripe account is now active! You can start receiving payments.',
            data: {
              accountId,
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

