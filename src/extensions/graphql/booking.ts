/**
 * GraphQL extension for booking operations with custom payment handling
 */

import {
  capturePaymentIntent,
  cancelPaymentIntent,
} from '../../utils/stripe';

export const bookingExtension = ({ strapi }) => ({
  resolvers: {
    Mutation: {
      /**
       * Custom update resolver for bookings
       * Handles payment capture/cancellation when reaction changes
       */
      updateBooking: async (parent, args, context) => {
        const { documentId, data } = args;
        const { reaction } = data || {};

        // Fetch current booking state before update
        const currentBooking = await strapi.documents('api::booking.booking').findOne({
          documentId,
          populate: ['artist', 'owner'],
        });

        if (!currentBooking) {
          throw new Error('Booking not found');
        }

        // Perform the update first
        const updatedBooking = await strapi.documents('api::booking.booking').update({
          documentId,
          data,
        });

        // If reaction changed and payment is authorized, handle capture/cancel
        if (
          reaction &&
          currentBooking.reaction !== reaction &&
          currentBooking.paymentStatus === 'authorized'
        ) {
          try {
            if (reaction === 'accepted' && currentBooking.stripePaymentIntentId) {
              // Artist accepted - capture the payment
              await capturePaymentIntent(currentBooking.stripePaymentIntentId);

              // Update payment status to paid
              const finalBooking = await strapi.documents('api::booking.booking').update({
                documentId,
                data: {
                  paymentStatus: 'paid',
                },
              });

              strapi.log.info(`Payment captured for booking ${documentId}`);

              return finalBooking;
            } else if (reaction === 'rejected' && currentBooking.stripePaymentIntentId) {
              // Artist rejected - cancel the payment
              await cancelPaymentIntent(currentBooking.stripePaymentIntentId);

              // Update payment status to cancelled
              const finalBooking = await strapi.documents('api::booking.booking').update({
                documentId,
                data: {
                  paymentStatus: 'cancelled',
                },
              });

              strapi.log.info(`Payment cancelled for booking ${documentId}`);

              return finalBooking;
            }
          } catch (error) {
            strapi.log.error('Error handling payment on reaction change:', error);
            // Don't fail the update, but log the error
            throw new Error(`Failed to process payment: ${error.message}`);
          }
        }

        return updatedBooking;
      },
    },
  },
  resolversConfig: {
    'Mutation.updateBooking': {
      auth: true, // Require authentication
    },
  },
});

