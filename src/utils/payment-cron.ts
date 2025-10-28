/**
 * Cron job for handling expired payment authorizations
 */

import { cancelPaymentIntent } from './stripe';

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
        paymentStatus: 'authorized',
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
            paymentStatus: 'cancelled',
            reaction: 'rejected',
            rejectNote: 'Automatically rejected due to expired payment authorization (7 days)',
          },
        });

        strapi.log.info(`Cancelled expired authorization for booking ${booking.id}`);

        // Send notification to owner
        try {
          await strapi.plugin('users-permissions').service('user').sendNotification({
            userId: booking.owner.id,
            type: 'booking_expired',
            message: 'Your booking request expired after 7 days without artist response. Payment authorization has been cancelled.',
            data: {
              bookingId: booking.id,
            },
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

