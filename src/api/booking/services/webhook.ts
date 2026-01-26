/**
 * Booking webhook handlers
 * Handles Stripe webhook events related to booking payments
 */

import Stripe from 'stripe';
import { sendPaymentSuccessEmail } from '../../../utils/email/payment-success';
import { sendFirebaseNotificationToUser } from '../../../utils/push-notification';
import { BookingWithRelations } from '../types/booking-populated';
import { NotifyType, PaymentStatus } from '../../../interfaces/enums';

/**
 * In Strapi v5, to keep a document Published after update,
 * you must explicitly call publish after the update if it was published before.
 */
async function updateBookingPreservePublication(
  bookingDocumentId: string,
  data: Record<string, unknown>
) {
  await strapi.documents('api::booking.booking').update({
    documentId: bookingDocumentId,
    data,
    status: 'published'
  });
}

/**
 * Handle checkout.session.completed event for bookings
 */
export async function handleBookingCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const bookingDocumentId = session.metadata?.bookingDocumentId;
  const paymentIntentId = session.payment_intent as string;

  if (!bookingDocumentId) {
    strapi.log.error('No bookingDocumentId in session metadata');
    return;
  }

  strapi.log.info(`Checkout session completed for bookingDocumentId ${bookingDocumentId}, payment intent: ${paymentIntentId}`);

  // Find booking
  const booking = await strapi.documents('api::booking.booking').findOne({
    documentId: bookingDocumentId,
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingDocumentId} not found`);
    return;
  }

  // Update booking with payment intent ID and keep it published
  await updateBookingPreservePublication(
    bookingDocumentId,
    {
      stripePaymentIntentId: paymentIntentId,
    }
  );
}

/**
 * Handle payment_intent.amount_capturable_updated event
 * Payment is authorized (funds on hold) - only for bookings
 */
export async function handleBookingPaymentIntentAuthorized(paymentIntent: Stripe.PaymentIntent) {
  const bookingDocumentId = paymentIntent.metadata?.bookingDocumentId;

  if (!bookingDocumentId) {
    strapi.log.error('No bookingDocumentId in payment intent metadata');
    return;
  }

  strapi.log.info(`Payment authorized for bookingDocumentId ${bookingDocumentId}`);

  // Find booking
  const booking = await strapi.documents('api::booking.booking').findOne({
    documentId: bookingDocumentId,
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingDocumentId} not found`);
    return;
  }

  // Update payment status to authorized and keep it published
  await updateBookingPreservePublication(
    bookingDocumentId,
    {
      paymentStatus: PaymentStatus.AUTHORIZED,
      stripePaymentIntentId: paymentIntent.id,
      authorizedAt: new Date().toISOString(),
    }
  );

  try {
    await strapi.service('api::booking.booking').notifyBookingCreated(booking);
  } catch (error) {
    strapi.log.error('Error sending booking created notifications:', error);
  }
}

/**
 * Handle payment_intent.succeeded event for bookings
 * Payment captured successfully (artist accepted)
 */
export async function handleBookingPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const bookingDocumentId = paymentIntent.metadata?.bookingDocumentId;

  if (!bookingDocumentId) {
    strapi.log.error('No bookingDocumentId in payment intent metadata');
    return;
  }

  strapi.log.info(`Payment succeeded for bookingDocumentId ${bookingDocumentId}`);

  // Find booking
  const booking = await strapi.documents('api::booking.booking').findOne({
    documentId: bookingDocumentId,
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingDocumentId} not found`);
    return;
  }

  // Update payment status to paid and keep it published
  await updateBookingPreservePublication(
    bookingDocumentId,
    {
      paymentStatus: PaymentStatus.PAID,
    }
  );

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
      await sendFirebaseNotificationToUser(booking.artist.id, {
        title: 'Payment Received',
        body: `Payment received for booking from ${booking.owner.username}`,
        data: {
          bookingId: booking.documentId,
          type: NotifyType.PAYMENT_SUCCEEDED,
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
 * Handle payment_intent.payment_failed event for bookings
 * Payment failed
 */
export async function handleBookingPaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const bookingDocumentId = paymentIntent.metadata?.bookingDocumentId;

  if (!bookingDocumentId) {
    strapi.log.error('No bookingDocumentId in payment intent metadata');
    return;
  }

  strapi.log.error(`Payment failed for bookingDocumentId ${bookingDocumentId}`);

  // Find booking
  const booking = await strapi.documents('api::booking.booking').findOne({
    documentId: bookingDocumentId,
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingDocumentId} not found`);
    return;
  }

  // Update booking with payment intent ID and keep it published
  await updateBookingPreservePublication(
    bookingDocumentId,
    {
      paymentStatus: PaymentStatus.FAILED,
    }
  );

  // Notify owner about failed payment
  try {
    await sendFirebaseNotificationToUser(booking.owner.id, {
      title: 'Payment Failed',
      body: `Payment failed for your booking. Please try again.`,
      data: {
        bookingId: booking.documentId,
        type: NotifyType.PAYMENT_FAILED,
      },
    });
  } catch (error) {
    strapi.log.error('Error sending notification:', error);
  }
}

/**
 * Handle payment_intent.canceled event for bookings
 * Payment cancelled (artist rejected or timeout)
 */
export async function handleBookingPaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const bookingDocumentId = paymentIntent.metadata?.bookingDocumentId;

  if (!bookingDocumentId) {
    strapi.log.error('No bookingDocumentId in payment intent metadata');
    return;
  }

  strapi.log.info(`Payment cancelled for bookingDocumentId ${bookingDocumentId}`);

  // Find booking
  const booking = await strapi.documents('api::booking.booking').findOne({
    documentId: bookingDocumentId,
    populate: ['artist', 'owner'],
  }) as BookingWithRelations | null;

  if (!booking) {
    strapi.log.error(`Booking ${bookingDocumentId} not found`);
    return;
  }

  // Update payment status to cancelled and keep it published
  await updateBookingPreservePublication(
    bookingDocumentId,
    {
      paymentStatus: PaymentStatus.CANCELLED,
    }
  );

  // Notify owner about cancelled payment
  try {
    await sendFirebaseNotificationToUser(booking.owner.id, {
      title: 'Payment Cancelled',
      body: `Payment cancelled for your booking. Funds have been released.`,
      data: {
        bookingId: booking.documentId,
        type: NotifyType.PAYMENT_CANCELLED,
      },
    });
  } catch (error) {
    strapi.log.error('Error sending notification:', error);
  }
}
