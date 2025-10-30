/**
 * booking service
 */

import { factories } from '@strapi/strapi';
import { capturePaymentIntent, cancelPaymentIntent } from '../../../utils/stripe';
import { PaymentStatus, BookingReaction } from '../../../interfaces/enums';

export default factories.createCoreService('api::booking.booking', ({ strapi }) => ({
  /**
   * Handle payment actions on reaction change (capture/cancel) for a booking
   */
  async handleReactionPayment(params: {
    documentId: string;
    previousReaction?: string | BookingReaction | null;
    newReaction?: string | BookingReaction | null;
    paymentStatus?: string | PaymentStatus | null;
    stripePaymentIntentId?: string | null;
  }): Promise<void> {
    const {
      documentId,
      previousReaction,
      newReaction,
      paymentStatus,
      stripePaymentIntentId,
    } = params;

    if (!newReaction || newReaction === previousReaction) return;
    if (paymentStatus !== PaymentStatus.AUTHORIZED) return;
    if (!stripePaymentIntentId) return;

    try {
      if (newReaction === BookingReaction.ACCEPTED) {
        await capturePaymentIntent(stripePaymentIntentId);
        await strapi.documents('api::booking.booking').update({
          documentId,
          data: { paymentStatus: PaymentStatus.PAID },
        });
        strapi.log.info(`Payment captured for booking ${documentId}`);
      } else if (newReaction === BookingReaction.REJECTED) {
        await cancelPaymentIntent(stripePaymentIntentId);
        await strapi.documents('api::booking.booking').update({
          documentId,
          data: { paymentStatus: PaymentStatus.CANCELLED },
        });
        strapi.log.info(`Payment cancelled for booking ${documentId}`);
      }
    } catch (error) {
      strapi.log.error('Error handling payment on reaction change:', error);
      throw error;
    }
  },
}));
