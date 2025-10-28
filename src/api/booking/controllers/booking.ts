/**
 * booking controller
 */

import { factories } from '@strapi/strapi';
import {
  createCheckoutSession,
  getBookingAmount,
  getPlatformFeePercent,
  calculatePlatformFee,
  getDefaultCurrency,
  capturePaymentIntent,
  cancelPaymentIntent,
} from '../../../utils/stripe';
import { BookingWithRelations } from '../types/booking-populated';

export default factories.createCoreController('api::booking.booking', ({ strapi }) => ({
  /**
   * Create payment session for a booking
   * This should be called immediately after booking creation
   */
  async createPayment(ctx) {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('You must be logged in');
      }

      // Fetch booking with relations
      const booking = await strapi.entityService.findOne('api::booking.booking', id, {
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
      if (booking.paymentStatus !== 'unpaid') {
        return ctx.badRequest(`Payment already ${booking.paymentStatus}`);
      }

      // Check if artist has Stripe Connect account
      if (!booking.artist?.stripeAccountID) {
        return ctx.badRequest('Artist does not have a Stripe account configured');
      }

      if (!booking.artist?.payoutsEnabled) {
        return ctx.badRequest('Artist has not enabled payouts yet');
      }

      // Get payment parameters from environment
      const amount = getBookingAmount();
      const currency = getDefaultCurrency();
      const platformFeePercent = getPlatformFeePercent();
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
        },
      });

      // Update booking with session ID and payment details
      const updatedBooking = await strapi.entityService.update('api::booking.booking', id, {
        data: {
          stripeCheckoutSessionId: session.id,
          amount,
          currency,
          platformFee,
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
    const { id } = ctx.params;
    const { reaction } = ctx.request.body.data || {};

    // Fetch current booking state
    const currentBooking = await strapi.entityService.findOne('api::booking.booking', id, {
      populate: ['artist', 'owner'],
    }) as BookingWithRelations | null;

    if (!currentBooking) {
      return ctx.notFound('Booking not found');
    }

    // Call default update first
    const response = await super.update(ctx);

    // If reaction changed and payment is authorized, handle capture/cancel
    if (reaction && currentBooking.reaction !== reaction && currentBooking.paymentStatus === 'authorized') {
      try {
        if (reaction === 'accepted' && currentBooking.stripePaymentIntentId) {
          // Artist accepted - capture the payment
          await capturePaymentIntent(currentBooking.stripePaymentIntentId);
          
          // Update payment status to paid
          await strapi.entityService.update('api::booking.booking', id, {
            data: {
              paymentStatus: 'paid',
            },
          });

          strapi.log.info(`Payment captured for booking ${id}`);
        } else if (reaction === 'rejected' && currentBooking.stripePaymentIntentId) {
          // Artist rejected - cancel the payment
          await cancelPaymentIntent(currentBooking.stripePaymentIntentId);
          
          // Update payment status to cancelled
          await strapi.entityService.update('api::booking.booking', id, {
            data: {
              paymentStatus: 'cancelled',
            },
          });

          strapi.log.info(`Payment cancelled for booking ${id}`);
        }
      } catch (error) {
        strapi.log.error('Error handling payment on reaction change:', error);
        // Don't fail the update, but log the error
      }
    }

    return response;
  },
}));
