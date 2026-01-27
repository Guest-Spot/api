/**
 * Guest Spot booking Stripe webhook handlers
 * Handles checkout.session.completed, payment_intent.succeeded, payment_intent.canceled
 */

import type Stripe from 'stripe';

export async function handleGuestSpotCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const bookingDocumentId = session.metadata?.guestSpotBookingDocumentId;
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;

  if (!bookingDocumentId) {
    strapi.log.error('Guest spot webhook: no guestSpotBookingDocumentId in session metadata');
    return;
  }

  strapi.log.info(
    `Guest spot checkout completed for booking ${bookingDocumentId}, paymentIntent: ${paymentIntentId}`
  );

  const booking = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
    documentId: bookingDocumentId,
  });

  if (!booking) {
    strapi.log.error(`Guest spot booking ${bookingDocumentId} not found`);
    return;
  }

  await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
    documentId: bookingDocumentId,
    data: {
      depositAuthorized: true,
      depositAuthorizedAt: new Date().toISOString(),
      ...(paymentIntentId && { paymentIntentId }),
    },
  });
}

export async function handleGuestSpotPaymentIntentSucceeded(_paymentIntent: Stripe.PaymentIntent) {
  // Optional: verify booking state. Main updates happen in checkout.session.completed.
}

export async function handleGuestSpotPaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const bookingDocumentId = paymentIntent.metadata?.guestSpotBookingDocumentId;

  if (!bookingDocumentId) {
    strapi.log.error('Guest spot webhook: no guestSpotBookingDocumentId in payment intent metadata');
    return;
  }

  strapi.log.info(`Guest spot payment canceled for booking ${bookingDocumentId}`);

  const booking = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
    documentId: bookingDocumentId,
  });

  if (!booking) {
    strapi.log.error(`Guest spot booking ${bookingDocumentId} not found`);
    return;
  }

  await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
    documentId: bookingDocumentId,
    data: { depositAuthorized: false },
  });
}
