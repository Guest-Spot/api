/**
 * Cron job for handling expired payment authorizations
 */

import { cancelPaymentIntent } from './stripe';
import { sendFirebaseNotificationToUser } from './push-notification';
import { sendBookingExpiredEmail } from './email/booking-expired';
import { PaymentStatus } from '../interfaces/enums';

/**
 * Cancel payment authorizations that are older than 7 days
 * Stripe automatically expires them after 7 days, but we want to be proactive
 */
export const cancelExpiredAuthorizations = async (strapi) => {
  try {
    strapi.log.info('Running cron job: Cancel expired payment authorizations');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find all bookings with authorized payments older than 7 days
    const expiredBookings = await strapi.db.query('api::booking.booking').findMany({
      where: {
        paymentStatus: PaymentStatus.AUTHORIZED,
        authorizedAt: {
          $lt: sevenDaysAgo.toISOString(),
        },
      },
      populate: ['artist', 'owner'],
    });

    if (expiredBookings.length === 0) {
      strapi.log.info('No expired authorizations found');
      return;
    }

    strapi.log.info(`Found ${expiredBookings.length} expired authorization(s)`);

    // Process each expired booking
    for (const booking of expiredBookings) {
      try {
        if (!booking.stripePaymentIntentId) {
          strapi.log.warn(`Booking ${booking.id} has no payment intent ID, skipping`);
          continue;
        }

        // Cancel the payment intent in Stripe
        await cancelPaymentIntent(booking.stripePaymentIntentId);

        // Update booking status
        await strapi.entityService.update('api::booking.booking', booking.id, {
          data: {
            paymentStatus: PaymentStatus.CANCELLED,
            reaction: 'rejected',
            rejectNote: 'Automatically rejected due to expired payment authorization (7 days)',
          },
        });

        strapi.log.info(`Cancelled expired authorization for booking ${booking.id}`);

        // Send notification and email to owner
        try {
          // Send push notification
          await sendFirebaseNotificationToUser(booking.owner.id, {
            title: 'Booking Expired',
            body: 'Your booking request expired after 7 days without artist response. Payment authorization has been cancelled.',
            data: {
              bookingId: String(booking.id),
              type: 'booking_expired',
            },
          });

          // Send email notification
          const amountValue = Number(booking.artist?.depositAmount);
          const normalizedAmount =
            Number.isFinite(amountValue) && amountValue > 0 ? Math.round(amountValue) : undefined;

          await sendBookingExpiredEmail({
            userName: booking.owner.username,
            userEmail: booking.owner.email,
            artistName: booking.artist.username,
            bookingId: booking.id,
            amount: normalizedAmount,
            currency: booking.currency,
            day: booking.day,
            start: booking.start,
          });
        } catch (notifError) {
          strapi.log.error(`Error sending notification for booking ${booking.id}:`, notifError);
        }
      } catch (error) {
        strapi.log.error(`Error cancelling authorization for booking ${booking.id}:`, error);
        // Continue with next booking
      }
    }

    strapi.log.info('Finished cancelling expired authorizations');
  } catch (error) {
    strapi.log.error('Error in cancelExpiredAuthorizations cron job:', error);
  }
};

