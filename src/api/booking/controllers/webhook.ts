/**
 * Stripe webhook controller
 */

import { verifyWebhookSignature, isAccountOnboarded } from '../../../utils/stripe';
import { sendPaymentSuccessEmail } from '../../../utils/email/payment-success';
import { sendFirebaseNotificationToUser } from '../../../utils/push-notification';
import Stripe from 'stripe';
import { BookingWithRelations } from '../types/booking-populated';
import { PaymentStatus } from '../../../interfaces/enums';

export default {
  /**
   * Handle Stripe webhook events
   * POST /api/webhooks/stripe
   */
  async handleStripeWebhook(ctx) {
    const sig = ctx.request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    strapi.log.debug('Webhook request received');

    if (!webhookSecret) {
      strapi.log.error('STRIPE_WEBHOOK_SECRET is not configured');
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
      event = verifyWebhookSignature(rawBody, sig, webhookSecret);
      
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
 * Keep published bookings in published state after programmatic updates.
 */
function keepBookingPublished(
  booking: BookingWithRelations | null,
  data: Record<string, unknown>
) {
  if (booking?.publishedAt) {
    return {
      ...data,
      publishedAt: new Date().toISOString(),
    };
  }

  return data;
}

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
    data: keepBookingPublished(booking, {
      stripePaymentIntentId: paymentIntentId,
    }),
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
    data: keepBookingPublished(booking, {
      paymentStatus: PaymentStatus.AUTHORIZED,
      stripePaymentIntentId: paymentIntent.id,
      authorizedAt: new Date().toISOString(),
    }),
  });

  // Send push notification to artist about new paid booking request
  try {
    await sendFirebaseNotificationToUser(booking.artist.id, {
      title: 'New Booking Request',
      body: `New booking request from ${booking.owner.username} (Payment authorized)`,
      data: {
        bookingId: String(booking.id),
        type: 'booking_created',
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
    data: keepBookingPublished(booking, {
      paymentStatus: PaymentStatus.PAID,
    }),
  });

  // Send email and push notifications to both parties
  try {
    // Send email to owner (guest)
    const amountValue = Number(booking.artist?.depositAmount);
    const normalizedAmount =
      Number.isFinite(amountValue) && amountValue > 0 ? Math.round(amountValue) : undefined;

    await sendPaymentSuccessEmail({
      userName: booking.owner.username,
      userEmail: booking.owner.email,
      artistName: booking.artist.username,
      bookingId: booking.id,
      amount: normalizedAmount,
      currency: booking.currency,
      isArtist: false,
    });

    // Send email to artist
    await sendPaymentSuccessEmail({
      userName: booking.artist.username,
      userEmail: booking.artist.email,
      artistName: booking.artist.username,
      bookingId: booking.id,
      amount: normalizedAmount,
      currency: booking.currency,
      isArtist: true,
    });

    // Send push notifications if available
    try {
      await sendFirebaseNotificationToUser(booking.owner.id, {
        title: 'Payment Successful',
        body: `Payment processed successfully for your booking`,
        data: {
          bookingId: String(booking.id),
          type: 'payment_succeeded',
        },
      });

      await sendFirebaseNotificationToUser(booking.artist.id, {
        title: 'Payment Received',
        body: `Payment received for booking from ${booking.owner.username}`,
        data: {
          bookingId: String(booking.id),
          type: 'payment_succeeded',
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
    data: keepBookingPublished(booking, {
      paymentStatus: PaymentStatus.FAILED,
    }),
  });

  // Notify owner about failed payment
  try {
    await sendFirebaseNotificationToUser(booking.owner.id, {
      title: 'Payment Failed',
      body: `Payment failed for your booking. Please try again.`,
      data: {
        bookingId: String(booking.id),
        type: 'payment_failed',
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
    data: keepBookingPublished(booking, {
      paymentStatus: PaymentStatus.CANCELLED,
    }),
  });

  // Notify owner about cancelled payment
  try {
    await sendFirebaseNotificationToUser(booking.owner.id, {
      title: 'Payment Cancelled',
      body: `Payment cancelled for your booking. Funds have been released.`,
      data: {
        bookingId: String(booking.id),
        type: 'payment_cancelled',
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
          await sendFirebaseNotificationToUser(user.id, {
            title: 'Stripe Account Activated',
            body: 'Your Stripe account is now active! You can start receiving payments.',
            data: {
              accountId,
              type: 'stripe_account_activated',
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
