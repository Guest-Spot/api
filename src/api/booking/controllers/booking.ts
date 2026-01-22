/**
 * booking controller
 */

import { factories } from '@strapi/strapi';
import { BookingWithRelations } from '../types/booking-populated';
import { canArtistReceivePayments } from '../../../utils/payments';
import { isStripeEnabled } from '../../../utils/stripe';
import isAdmin from '../../../utils/isAdmin';

export default factories.createCoreController('api::booking.booking', ({ strapi }) => ({
  /**
   * Custom create to send notifications based on payout settings
   */
  async create(ctx) {
    const response = await super.create(ctx);

    if (!canArtistReceivePayments(response.artist)) {
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

      // Check if Stripe is enabled
      const stripeEnabled = await isStripeEnabled();
      if (!stripeEnabled) {
        return ctx.badRequest('Stripe payments are disabled');
      }

      const result = await strapi.service('api::booking.booking').createPaymentSession({
        documentId: bookingDocumentId,
        userId,
        userDocumentId: ctx.state.user?.documentId,
      });

      ctx.send(result);
    } catch (error) {
      strapi.log.error('Error creating payment session:', error);
      
      // Convert service errors to appropriate HTTP responses
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session';
      
      if (errorMessage.includes('not found')) {
        return ctx.notFound(errorMessage);
      }
      if (errorMessage.includes('can only create payment')) {
        return ctx.forbidden(errorMessage);
      }
      
      return ctx.badRequest(errorMessage);
    }
  },

  /**
   * Get booking statistics
   * Accessible from admin panel or with admin permissions
   */
  async statistics(ctx) {
    try {
      // Check if request is from admin panel using isAdmin utility
      // This works even when auth: false is set in route config
      if (!isAdmin()) {
        return ctx.forbidden('Admin access required');
      }

      const stats = await strapi.service('api::booking.booking').getStatistics();
      ctx.body = { data: stats };
    } catch (error) {
      strapi.log.error('Error getting booking statistics:', error);
      ctx.throw(500, error);
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
