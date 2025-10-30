/**
 * GraphQL extension for Stripe payment operations
 */

import {
  createCheckoutSession,
  getPlatformFeePercent,
  calculatePlatformFee,
  getDefaultCurrency,
} from '../../utils/stripe';

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

        // Fetch booking with relations
        const booking = await strapi.documents('api::booking.booking').findOne({
          documentId,
          populate: ['artist', 'owner'],
        });

        if (!booking) {
          throw new Error('Booking not found');
        }

        // Check if user is the owner of the booking
        if (booking.owner?.documentId !== context.state.user.documentId) {
          throw new Error('You can only create payment for your own bookings');
        }

        // Check if payment already exists
        if (booking.paymentStatus !== 'unpaid') {
          throw new Error(`Payment already ${booking.paymentStatus}`);
        }

        // Check if artist has Stripe Connect account
        if (!booking.artist?.stripeAccountID) {
          throw new Error('Artist does not have a Stripe account configured');
        }

        if (!booking.artist?.payoutsEnabled) {
          throw new Error('Artist has not enabled payouts yet');
        }

        // Use artist-configured deposit amount for payment
        const amountValue = Number(booking.artist?.depositAmount);

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
          throw new Error('Artist deposit amount is not configured');
        }

        const amount = Math.round(amountValue);
        const currency = getDefaultCurrency();
        const platformFeePercent = getPlatformFeePercent();
        const platformFee = calculatePlatformFee(amount, platformFeePercent);

        try {
          // Create Checkout Session with pre-authorization
          const session = await createCheckoutSession({
            bookingId: booking.id,
            amount,
            currency,
            platformFee,
            artistStripeAccountId: booking.artist.stripeAccountID,
            customerEmail,
            metadata: {
              bookingDocumentId: documentId,
              ownerId: booking.owner.id.toString(),
              artistId: booking.artist.id.toString(),
              ownerDocumentId: booking.owner.documentId,
              artistDocumentId: booking.artist.documentId,
            },
          });

          // Update booking with session ID and payment details
          const updatedBooking = await strapi.documents('api::booking.booking').update({
            documentId,
            data: {
              stripeCheckoutSessionId: session.id,
              currency,
            },
          });

          strapi.log.info(`Payment session created for booking ${documentId}: ${session.id}`);

          return {
            sessionId: session.id,
            sessionUrl: session.url,
            booking: updatedBooking,
          };
        } catch (error) {
          strapi.log.error('Error creating payment session:', error);
          throw new Error('Failed to create payment session');
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
