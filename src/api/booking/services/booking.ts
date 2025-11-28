/**
 * booking service
 */

import { factories } from '@strapi/strapi';
import {
  capturePaymentIntent, cancelPaymentIntent, createCheckoutSession,
  calculatePlatformFee,
  getDefaultCurrency,
  getPlatformFeePercent,
  STRIPE_FEE_PERCENT,
  isStripeEnabled,
} from '../../../utils/stripe';
import { PaymentStatus, BookingReaction, NotifyType } from '../../../interfaces/enums';
import { createNotification } from '../../../utils/notification';
import { sendFirebaseNotificationToUser } from '../../../utils/push-notification';
import { sendBookingResponseEmail } from '../../../utils/email/booking-response';
import { sendBookingNotificationEmail } from '../../../utils/email/booking-notification';
import isAdmin from '../../../utils/isAdmin';
import { formatTimeToAmPm } from '../../../utils/formatTime';
import { parseDateOnly } from '../../../utils/date';
import { BookingWithRelations } from '../types/booking-populated';
import { canArtistReceivePayments } from '../../../utils/payments';

export default factories.createCoreService('api::booking.booking', ({ strapi }) => ({
  /**
   * Create payment session for a booking
   * Centralized logic for creating Stripe Checkout Session
   */
  async createPaymentSession(params: {
    documentId: string;
    userId: number;
    userDocumentId?: string;
    customerEmail?: string;
  }): Promise<{ sessionId: string; sessionUrl: string; booking: any }> {
    const { documentId, userId, userDocumentId, customerEmail } = params;

    // Check if Stripe is enabled
    const stripeEnabled = await isStripeEnabled();
    if (!stripeEnabled) {
      throw new Error('Stripe payments are disabled');
    }

    // Fetch booking with relations
    const booking = await strapi.documents('api::booking.booking').findOne({
      documentId,
      populate: ['artist', 'owner'],
    }) as BookingWithRelations | null;

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if user is the owner of the booking (support both id and documentId)
    const isOwner = booking.owner?.id === userId || 
                   (userDocumentId && booking.owner?.documentId === userDocumentId);
    if (!isOwner) {
      throw new Error('You can only create payment for your own bookings');
    }

    // Check if payment already exists
    if (booking.paymentStatus !== PaymentStatus.UNPAID) {
      throw new Error(`Payment already ${booking.paymentStatus}`);
    }

    // Check if artist has Stripe Connect account
    if (!booking.artist?.stripeAccountID) {
      throw new Error('Artist does not have a Stripe account configured');
    }

    if (!canArtistReceivePayments(booking.artist)) {
      if (!booking.artist?.payoutsEnabled) {
        throw new Error('Artist has not enabled payouts yet');
      }
      throw new Error('Artist is not verified to receive payments');
    }

    // Use artist-configured deposit amount for payment
    const amountValue = Number(booking.artist?.depositAmount);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new Error('Artist deposit amount is not configured');
    }

    const currency = getDefaultCurrency();
    const platformFeePercent = await getPlatformFeePercent();
    
    // Calculate total amount including platform fee
    const depositAmount = Math.round(amountValue);
    const platformFee = calculatePlatformFee(depositAmount, platformFeePercent + STRIPE_FEE_PERCENT);
    const totalAmount = depositAmount + platformFee;

    // Create Checkout Session with pre-authorization
    const session = await createCheckoutSession({
      bookingId: booking.id,
      amount: totalAmount,
      currency,
      platformFee,
      artistStripeAccountId: booking.artist.stripeAccountID,
      customerEmail,
      metadata: {
        bookingDocumentId: documentId,
        ownerId: booking.owner.id.toString(),
        artistId: booking.artist.id.toString(),
        ...(booking.owner?.documentId && { ownerDocumentId: booking.owner.documentId }),
        ...(booking.artist?.documentId && { artistDocumentId: booking.artist.documentId }),
      },
    });

    // Update booking with session ID and payment details
    const updatedBooking = await strapi.documents('api::booking.booking').update({
      documentId,
      data: {
        stripeCheckoutSessionId: session.id,
        currency,
      },
      status: 'published',
    });

    strapi.log.info(`Payment session created for booking ${documentId}: ${session.id}`);

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      booking: updatedBooking,
    };
  },

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

    // Check if Stripe is enabled
    const stripeEnabled = await isStripeEnabled();
    if (!stripeEnabled) {
      strapi.log.warn(`Stripe is disabled, skipping payment handling for booking ${documentId}`);
      return;
    }

    try {
      if (newReaction === BookingReaction.ACCEPTED) {
        await capturePaymentIntent(stripePaymentIntentId);
        await strapi.documents('api::booking.booking').update({
          documentId,
          data: { paymentStatus: PaymentStatus.PAID },
          status: 'published',
        });
        strapi.log.info(`Payment captured for booking ${documentId}`);
      } else if (newReaction === BookingReaction.REJECTED) {
        await cancelPaymentIntent(stripePaymentIntentId);
        await strapi.documents('api::booking.booking').update({
          documentId,
          data: { paymentStatus: PaymentStatus.CANCELLED },
          status: 'published',
        });
        strapi.log.info(`Payment cancelled for booking ${documentId}`);
      }
    } catch (error) {
      strapi.log.error('Error handling payment on reaction change:', error);
      throw error;
    }
  },

  /**
   * Send notifications and email when reaction changes to ACCEPTED or REJECTED
   */
  async notifyReactionChange(params: {
    booking: any; // Booking with artist and owner populated
    previousReaction?: string | BookingReaction | null;
  }): Promise<void> {
    const { booking, previousReaction } = params;
    const newReaction = booking?.reaction as BookingReaction | undefined;

    if (!newReaction || newReaction === previousReaction) return;
    if (newReaction !== BookingReaction.ACCEPTED && newReaction !== BookingReaction.REJECTED) return;

    const isAccepted = newReaction === BookingReaction.ACCEPTED;

    const artist = booking.artist ?? {};
    const owner = booking.owner ?? {};

    const artistDocumentId = artist.documentId ?? (typeof artist.id === 'number' ? String(artist.id) : null);
    const guestDocumentId = owner.documentId ?? (typeof owner.id === 'number' ? String(owner.id) : null);
    const guestUserId = typeof owner.id === 'number' ? owner.id : null;

    if (!artistDocumentId || !guestDocumentId) return;

    const type = isAccepted ? NotifyType.BOOKING_ACCEPTED : NotifyType.BOOKING_REJECTED;

    // Create in-app notification
    await createNotification({
      ownerDocumentId: artistDocumentId,
      recipientDocumentId: guestDocumentId,
      type,
      body: booking,
    });

    // Prepare push body
    const bookingDate = parseDateOnly(booking.day);
    const formattedDate =
      bookingDate && !Number.isNaN(bookingDate.getTime())
        ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(bookingDate)
        : null;
    const bodyParts: string[] = [
      `${artist.username ?? artist.name ?? 'Artist'} ${isAccepted ? 'accepted' : 'declined'} your booking request`,
    ];
    if (formattedDate) bodyParts.push(`for ${formattedDate}`);
    const formattedStartTime = formatTimeToAmPm(booking.start);
    if (formattedStartTime) bodyParts.push(`at ${formattedStartTime}`);
    if (!isAccepted) {
      const rejectNote = typeof booking.rejectNote === 'string' ? booking.rejectNote.trim() : '';
      if (rejectNote) bodyParts.push(`Reason: ${rejectNote}`);
    }

    // Send push notification to guest
    if (guestUserId) {
      try {
        await sendFirebaseNotificationToUser(guestUserId, {
          title: isAccepted ? 'Booking accepted' : 'Booking rejected',
          body: bodyParts.join(' '),
          data: {
            notifyType: type,
            bookingDocumentId: booking.documentId ?? undefined,
          },
        });
      } catch (error) {
        strapi.log.error('Error sending reaction push notification:', error);
      }
    }

    // Send email to guest
    try {
      await sendBookingResponseEmail({
        guestName: booking.name || owner?.username || 'Guest',
        guestEmail: booking.email || owner?.email,
        artistName: artist.name || artist.contactName || artist.username || artist.email || 'Artist',
        reaction: newReaction,
        day: booking.day,
        start: formattedStartTime ?? booking.start ?? null,
        location: booking.location,
        rejectNote: !isAccepted ? booking.rejectNote ?? null : null,
      });
    } catch (error) {
      strapi.log.error('Error sending reaction email:', error);
    }
  },

  /**
   * Notify artist on booking creation (when published and meaningful)
   */
  async notifyBookingCreated(booking: any): Promise<void> {
    if (!booking || isAdmin()) return;

    const artist = booking.artist ?? {};
    const owner = booking.owner ?? {};
    const artistDocumentId = artist.documentId ?? (typeof artist.id === 'number' ? String(artist.id) : null);
    const guestDocumentId = owner.documentId ?? (typeof owner.id === 'number' ? String(owner.id) : null);
    const artistUserId = typeof artist.id === 'number' ? artist.id : null;
    const guestName = booking.name || owner?.username || 'Guest';

    if (!artistDocumentId || !guestDocumentId || !artistUserId) return;

    // In-app notification to artist
    await createNotification({
      ownerDocumentId: guestDocumentId,
      recipientDocumentId: artistDocumentId,
      type: NotifyType.BOOKING_CREATED,
      body: booking,
    });

    // Push notification to artist
    try {
      const bookingDate = parseDateOnly(booking.day);
      const formattedDate =
        bookingDate && !Number.isNaN(bookingDate.getTime())
          ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(bookingDate)
          : null;
      const notificationBodyParts = [`Request from ${guestName}`];
      if (formattedDate) notificationBodyParts.push(`on ${formattedDate}`);
      const formattedStartTime = formatTimeToAmPm(booking.start);
      if (formattedStartTime) notificationBodyParts.push(`at ${formattedStartTime}`);

      await sendFirebaseNotificationToUser(artistUserId, {
        title: 'New booking request',
        body: notificationBodyParts.join(' '),
        data: {
          notifyType: NotifyType.BOOKING_CREATED,
          bookingDocumentId: booking.documentId ?? undefined,
        },
      });
    } catch (error) {
      strapi.log.error('Error sending booking created push notification:', error);
    }

    // Email notification to artist
    try {
      const formattedStartTime = formatTimeToAmPm(booking.start);
      await sendBookingNotificationEmail({
        artistName: artist.name || artist.contactName || artist.username || artist.email || 'Artist',
        artistEmail: artist?.email,
        guestName,
        guestEmail: booking.email,
        guestPhone: booking.phone,
        location: booking.location,
        placement: booking.placement,
        size: booking.size,
        description: booking.description,
        day: booking.day,
        start: formattedStartTime ?? booking.start ?? null,
        documentId: booking.documentId,
      });
    } catch (error) {
      strapi.log.error('Error sending booking created email:', error);
    }
  },
}));
