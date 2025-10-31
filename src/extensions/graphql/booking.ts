/**
 * GraphQL extension for booking operations with custom payment handling
 */

export const bookingExtension = ({ strapi }) => ({
  resolvers: {
    Mutation: {
      /**
       * Custom create resolver for bookings with conditional notifications
       */
      createBooking: async (parent, args, context) => {
        const { data } = args;

        const created = await strapi.documents('api::booking.booking').create({
          data,
          populate: ['artist', 'owner'],
          status: 'published',
        });

        if (!created?.documentId) {
          return created;
        }

        try {
          await strapi.service('api::booking.booking').notifyBookingCreated(created);
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
          status: 'published',
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

        // Send notifications if needed
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

