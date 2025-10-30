/**
 * Booking lifecycle hooks
 * Handles notification creation for booking-related events
 */

import { BookingReaction, NotifyType } from '../../../../interfaces/enums';
import { sendBookingNotificationEmail } from '../../../../utils/email/booking-notification';
import { sendBookingResponseEmail } from '../../../../utils/email/booking-response';
import { sendFirebaseNotificationToUser } from '../../../../utils/push-notification';
import isAdmin from '../../../../utils/isAdmin';
import { formatTimeToAmPm } from '../../../../utils/formatTime';
import { createNotification } from '../../../../utils/notification';
import { parseDateOnly } from '../../../../utils/date';
import { PaymentStatus } from '../../../../interfaces/enums';

type BookingIdentifier = { id?: number; documentId?: string };

const BOOKING_POPULATE = {
  artist: true,
  owner: true,
};

/**
 * Resolve a booking with related artist and owner data
 */
async function findBooking(identifier: BookingIdentifier): Promise<any | null> {
  try {
    if (identifier.documentId) {
      return await strapi
        .documents('api::booking.booking')
        .findOne({ documentId: identifier.documentId, populate: BOOKING_POPULATE });
    }

    if (identifier.id) {
      return await strapi.entityService.findOne('api::booking.booking', identifier.id, {
        populate: BOOKING_POPULATE,
      });
    }
  } catch (error) {
    strapi.log.error('Error fetching booking for notification lifecycle:', error);
  }

  return null;
}

/**
 * Extract a stable user identifier (documentId preferred, fallback to id)
 */
function getUserDocumentId(user: any): string | null {
  if (!user) {
    return null;
  }

  if (user.documentId) {
    return user.documentId;
  }

  if (user.id !== undefined && user.id !== null) {
    return user.id.toString();
  }

  return null;
}

/**
 * Resolve artist display name with optional email fallback
 */
function getArtistDisplayName(
  artist: any,
  options: { includeEmailFallback?: boolean } = {}
): string {
  if (!artist) {
    return 'Artist';
  }

  const { includeEmailFallback = false } = options;
  const preferredKeys: Array<'name' | 'contactName' | 'username'> = ['name', 'contactName', 'username'];

  for (const key of preferredKeys) {
    const value = artist[key];

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  if (includeEmailFallback && typeof artist.email === 'string' && artist.email.trim()) {
    return artist.email.trim();
  }

  return 'Artist';
}


/**
 * Send push notification to artist about a new booking request
 */
async function sendBookingCreatedPushNotification(
  booking: any,
  context: { guestName: string; guestDocumentId: string; artistUserId: number | null }
) {
  const { guestName, guestDocumentId, artistUserId } = context;

  if (!artistUserId || !guestDocumentId) {
    return;
  }

  const bookingDate = parseDateOnly(booking.day);
  const formattedDate =
    bookingDate && !Number.isNaN(bookingDate.getTime())
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(bookingDate)
      : null;
  const notificationBodyParts = [`Request from ${guestName}`];

  if (formattedDate) {
    notificationBodyParts.push(`on ${formattedDate}`);
  }

  const formattedStartTime = formatTimeToAmPm(booking.start);

  if (formattedStartTime) {
    notificationBodyParts.push(`at ${formattedStartTime}`);
  }

  const notificationBody = notificationBodyParts.join(' ');

  await sendFirebaseNotificationToUser(artistUserId, {
    title: 'New booking request',
    body: notificationBody,
    data: {
      notifyType: NotifyType.BOOKING_CREATED,
      bookingDocumentId: booking.documentId ?? undefined,
    },
  });
}

/**
 * Send push notification to guest when artist reacts to a booking
 */
async function sendBookingReactionPushNotification(
  booking: any,
  context: {
    guestUserId: number | null;
    guestDocumentId: string;
    artistDocumentId: string;
    type: NotifyType;
    artistName: string;
  }
) {
  const { guestUserId, guestDocumentId, artistDocumentId, type, artistName } = context;

  if (!guestUserId) {
    return;
  }

  const isAccepted = type === NotifyType.BOOKING_ACCEPTED;
  const bookingDate = parseDateOnly(booking.day);
  const formattedDate =
    bookingDate && !Number.isNaN(bookingDate.getTime())
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(bookingDate)
      : null;

  const bodyParts = [`${artistName} ${isAccepted ? 'accepted' : 'declined'} your booking request`];

  if (formattedDate) {
    bodyParts.push(`for ${formattedDate}`);
  }

  const formattedStartTime = formatTimeToAmPm(booking.start);

  if (formattedStartTime) {
    bodyParts.push(`at ${formattedStartTime}`);
  }

  if (!isAccepted) {
    const rejectNote =
      typeof booking.rejectNote === 'string' ? booking.rejectNote.trim() : '';

    if (rejectNote) {
      bodyParts.push(`Reason: ${rejectNote}`);
    }
  }

  await sendFirebaseNotificationToUser(guestUserId, {
    title: isAccepted ? 'Booking accepted' : 'Booking rejected',
    body: bodyParts.join(' '),
    data: {
      notifyType: type,
      bookingDocumentId: booking.documentId ?? undefined,
    },
  });
}

export default {
  /**
   * Store current booking state before update to detect reaction changes
   */
  async beforeUpdate(event) {
    const { where } = event.params;

    if (!where) {
      return;
    }

    const identifier: BookingIdentifier = {
      id: typeof where.id === 'number' ? where.id : undefined,
      documentId: typeof where.documentId === 'string' ? where.documentId : undefined,
    };

    // Support updates where id is provided as string
    if (!identifier.id && typeof where.id === 'string') {
      const parsed = Number(where.id);
      if (!Number.isNaN(parsed)) {
        identifier.id = parsed;
      }
    }

    const previousBooking = await findBooking(identifier);

    event.state = {
      ...(event.state || {}),
      previousBooking,
    };
  },

  /**
   * Notify artist when a booking is created
   */
  async afterCreate(event) {
    const result = event.result;
    const isDraft = !result.publishedAt;
    
    if (isDraft || isAdmin()) {
      return;
    }

    const identifier: BookingIdentifier = {
      documentId: result?.documentId,
      id: result?.id,
    };

    const booking = await findBooking(identifier);

    if (!booking) {
      return;
    }

    const artistDocumentId = getUserDocumentId(booking.artist);
    const guestDocumentId = getUserDocumentId(booking.owner);
    const artistUserId = typeof booking.artist?.id === 'number' ? booking.artist.id : null;
    const guestName = booking.name || booking.owner?.username || 'Guest';

    if (!artistDocumentId || !guestDocumentId) {
      return;
    }

    if (booking.paymentStatus === PaymentStatus.UNPAID && booking.artist?.payoutsEnabled === true) {
      return;
    }

    if (booking.reaction === BookingReaction.PENDING) {
      // Create in-app notification
      await createNotification({
        ownerDocumentId: guestDocumentId,
        recipientDocumentId: artistDocumentId,
        type: NotifyType.BOOKING_CREATED,
        body: booking,
      });
  
      // Send push notification to artist
      await sendBookingCreatedPushNotification(booking, {
        guestName,
        guestDocumentId,
        artistUserId,
      });
  
      // Send email notification to artist
      try {
        const formattedStartTime = formatTimeToAmPm(booking.start);
  
        await sendBookingNotificationEmail({
          artistName: getArtistDisplayName(booking.artist, { includeEmailFallback: true }),
          artistEmail: booking.artist?.email,
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
        strapi.log.error('Error sending booking notification email:', error);
      }
    }
  },
};
