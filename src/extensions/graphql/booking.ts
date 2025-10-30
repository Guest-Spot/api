/**
 * GraphQL extension for booking operations with custom payment handling
 */

import { PaymentStatus } from '../../interfaces/enums';

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

        // Delegate reaction-based payment handling to service
        await strapi.service('api::booking.booking').handleReactionPayment({
          documentId,
          previousReaction: currentBooking.reaction,
          newReaction: reaction,
          paymentStatus: currentBooking.paymentStatus,
          stripePaymentIntentId: currentBooking.stripePaymentIntentId,
        });

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

