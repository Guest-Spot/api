/**
 * GraphQL extension for booking operations with custom payment handling
 */

import { PaymentStatus } from '../../interfaces/enums';

export const bookingExtension = ({ strapi }) => ({
  resolvers: {
    Mutation: {
      /**
       * Custom create resolver for bookings with notifications
       */
      createBooking: async (parent, args, context) => {
        const { data } = args;

        // Create booking first
        const created = await strapi.documents('api::booking.booking').create({
          data,
        });

        // Fetch with relations to notify
        try {
          const booking = await strapi.documents('api::booking.booking').findOne({
            documentId: created.documentId,
            populate: ['artist', 'owner'],
          });

          await strapi.service('api::booking.booking').notifyBookingCreated(booking);
        } catch (error) {
          strapi.log.error('Error sending booking created notifications (GraphQL):', error);
        }

        return created;
      },
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

        // Send reaction notifications if needed
        try {
          const refreshed = await strapi.documents('api::booking.booking').findOne({
            documentId,
            populate: ['artist', 'owner'],
          });
          await strapi.service('api::booking.booking').notifyReactionChange({
            booking: refreshed,
            previousReaction: currentBooking.reaction,
          });
        } catch (error) {
          strapi.log.error('Error sending reaction notifications (GraphQL):', error);
        }

        return updatedBooking;
      },
    },
  },
  resolversConfig: {
    'Mutation.createBooking': {
      auth: true,
    },
    'Mutation.updateBooking': {
      auth: true, // Require authentication
    },
  },
});

