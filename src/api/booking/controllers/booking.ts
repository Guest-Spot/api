/**
 * booking controller
 */

import { factories } from '@strapi/strapi';
import {
  createCheckoutSession,
  calculatePlatformFee,
  getDefaultCurrency,
  getPlatformFeePercent,
} from '../../../utils/stripe';
import { BookingWithRelations } from '../types/booking-populated';
import { PaymentStatus } from '../../../interfaces/enums';

export default factories.createCoreController('api::booking.booking', ({ strapi }) => ({
  /**
   * Custom create to send notifications based on payout settings
   */
  async create(ctx) {
    const response = await super.create(ctx);

    if (!response.artist?.payoutsEnabled) {
      try {
        await strapi.service('api::booking.booking').notifyBookingCreated(response);
      } catch (error) {
        strapi.log.error('Error sending booking created notifications:', error);
      }
    }

    return response;
  },
  /**
   * Create payment session for a booking
   * This should be called immediately after booking creation
   */
  async createPayment(ctx) {
    try {
      const { bookingDocumentId } = ctx.params;
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('You must be logged in');
      }

      // Fetch booking with relations by documentId (Strapi v5)
      const booking = await strapi.documents('api::booking.booking').findOne({
        documentId: bookingDocumentId,
        populate: ['artist', 'owner'],
      }) as BookingWithRelations | null;

      if (!booking) {
        return ctx.notFound('Booking not found');
      }

      // Check if user is the owner of the booking
      if (booking.owner?.id !== userId) {
        return ctx.forbidden('You can only create payment for your own bookings');
      }

      // Check if payment already exists
      if (booking.paymentStatus !== PaymentStatus.UNPAID) {
        return ctx.badRequest(`Payment already ${booking.paymentStatus}`);
      }

      // Check if artist has Stripe Connect account
      if (!booking.artist?.stripeAccountID) {
        return ctx.badRequest('Artist does not have a Stripe account configured');
      }

      if (!booking.artist?.payoutsEnabled) {
        return ctx.badRequest('Artist has not enabled payouts yet');
      }

      // Use artist-configured deposit amount for payment
      const amountValue = Number(booking.artist?.depositAmount);

      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return ctx.badRequest('Artist deposit amount is not configured');
      }

      const amount = Math.round(amountValue);
      const currency = getDefaultCurrency();
      const platformFeePercent = await getPlatformFeePercent();
      const platformFee = calculatePlatformFee(amount, platformFeePercent);

      // Create Checkout Session with pre-authorization
      const session = await createCheckoutSession({
        bookingId: booking.id,
        amount,
        currency,
        platformFee,
        artistStripeAccountId: booking.artist.stripeAccountID,
        metadata: {
          ownerId: booking.owner.id.toString(),
          artistId: booking.artist.id.toString(),
          bookingDocumentId: bookingDocumentId.toString(),
        },
      });

      // Update booking with session ID and payment details using documentId
      const updatedBooking = await strapi.documents('api::booking.booking').update({
        documentId: bookingDocumentId,
        data: {
          stripeCheckoutSessionId: session.id,
          currency,
        },
      });

      ctx.send({
        sessionId: session.id,
        sessionUrl: session.url,
        booking: updatedBooking,
      });
    } catch (error) {
      strapi.log.error('Error creating payment session:', error);
      ctx.badRequest('Failed to create payment session');
    }
  },

  /**
   * Handle reaction change (accept/reject)
   * Captures or cancels the pre-authorized payment
   */
  async update(ctx) {
    const { documentId } = ctx.params;
    const { reaction } = ctx.request.body.data || {};

    // Fetch current booking state
    const currentBooking = await strapi.documents('api::booking.booking').findOne({
      documentId,
      populate: ['artist', 'owner'],
    }) as BookingWithRelations | null;

    if (!currentBooking) {
      return ctx.notFound('Booking not found');
    }

    // Call default update first
    const response = await super.update(ctx);

    // Delegate reaction-based payment handling to service
    await strapi.service('api::booking.booking').handleReactionPayment({
      documentId,
      previousReaction: currentBooking.reaction,
      newReaction: reaction,
      paymentStatus: currentBooking.paymentStatus,
      stripePaymentIntentId: currentBooking.stripePaymentIntentId,
    });

    // Fetch updated booking and send reaction notifications if needed
    try {
      const updated = (await strapi.documents('api::booking.booking').findOne({
        documentId,
        populate: ['artist', 'owner'],
      })) as BookingWithRelations | null;

      await strapi.service('api::booking.booking').notifyReactionChange({
        booking: updated,
        previousReaction: currentBooking.reaction,
      });
    } catch (error) {
      strapi.log.error('Error sending reaction notifications:', error);
    }

    return response;
  },
}));
