/**
 * GraphQL extension for Stripe payment operations
 */

import { isStripeEnabled } from '../../utils/stripe';

export const paymentExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    type PaymentSession {
      sessionId: String!
      sessionUrl: String!
      booking: Booking
    }

    extend type Mutation {
      createBookingPayment(documentId: ID!, customerEmail: String): PaymentSession!
    }
  `,
  resolvers: {
    Mutation: {
      /**
       * Create Stripe Checkout Session for a booking
       * @param documentId - Document ID of the booking to create payment for
       * @param customerEmail - Optional email to prefill in Stripe Checkout
       * @returns PaymentSession with sessionId, sessionUrl and updated booking
       */
      async createBookingPayment(parent, args, context) {
        const { documentId, customerEmail } = args;
        const userId = context.state?.user?.id;

        // Check authentication
        if (!userId) {
          throw new Error('You must be logged in to create a payment');
        }

        // Check if Stripe is enabled
        const stripeEnabled = await isStripeEnabled();
        if (!stripeEnabled) {
          throw new Error('Stripe payments are disabled');
        }

        try {
          const result = await strapi.service('api::booking.booking').createPaymentSession({
            documentId,
            userId,
            userDocumentId: context.state.user.documentId,
            customerEmail,
          });

          return result;
        } catch (error) {
          strapi.log.error('Error creating payment session:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session';
          throw new Error(errorMessage);
        }
      },
    },
  },
  resolversConfig: {
    'Mutation.createBookingPayment': {
      auth: true, // Require authentication
    },
  },
});
