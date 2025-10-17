/**
 * Booking lifecycle hooks
 * Handles notification creation for booking-related events
 */

import { BookingReaction, NotifyType } from '../../../../interfaces/enums';
import { sendBookingNotificationEmail } from '../../../../utils/email/booking-notification';
import { sendBookingResponseEmail } from '../../../../utils/email/booking-response';
import isAdmin from '../../../../utils/isAdmin';

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
 * Create notify entity with provided payload
 */
async function createNotification(ownerDocumentId: string, recipientDocumentId: string, type: NotifyType, booking: any) {
  try {
    await strapi.entityService.create('api::notify.notify', {
      data: {
        ownerDocumentId,
        recipientDocumentId,
        type,
        body: booking,
        publishedAt: new Date(),
      },
    });
  } catch (error) {
    strapi.log.error(`Error creating booking notification of type ${type}:`, error);
  }
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

    if (!booking || booking.reaction !== BookingReaction.PENDING) {
      return;
    }

    const artistId = getUserDocumentId(booking.artist);
    const guestId = getUserDocumentId(booking.owner);

    if (!artistId || !guestId) {
      return;
    }

    // Create in-app notification
    await createNotification(guestId, artistId, NotifyType.BOOKING_CREATED, booking);

    // Send email notification to artist
    try {
      await sendBookingNotificationEmail({
        artistName: booking.artist?.username || booking.artist?.email || 'Artist',
        artistEmail: booking.artist?.email,
        guestName: booking.name || booking.owner?.username || 'Guest',
        guestEmail: booking.email,
        guestPhone: booking.phone,
        location: booking.location,
        placement: booking.placement,
        size: booking.size,
        description: booking.description,
        day: booking.day,
        start: booking.start,
        documentId: booking.documentId,
      });
    } catch (error) {
      strapi.log.error('Error sending booking notification email:', error);
    }
  },

  /**
   * Notify guest when artist updates booking reaction (accept/reject)
   */
  async afterUpdate(event) {
    const updated = event.result;

    const previousReaction = event.state?.previousBooking?.reaction;
    const identifier: BookingIdentifier = {
      documentId: updated?.documentId,
      id: updated?.id,
    };

    const booking = await findBooking(identifier);

    if (!booking) {
      return;
    }

    const currentReaction = booking.reaction;

    if (
      !currentReaction ||
      currentReaction === previousReaction ||
      (currentReaction !== 'accepted' && currentReaction !== 'rejected')
    ) {
      return;
    }

    const artistId = getUserDocumentId(booking.artist);
    const guestId = getUserDocumentId(booking.owner);

    if (!artistId || !guestId) {
      return;
    }

    const type =
      currentReaction === 'accepted' ? NotifyType.BOOKING_ACCEPTED : NotifyType.BOOKING_REJECTED;

    // Create in-app notification
    await createNotification(artistId, guestId, type, booking);

    // Send email notification to guest
    try {
      await sendBookingResponseEmail({
        guestName: booking.name || booking.owner?.username || 'Guest',
        guestEmail: booking.email || booking.owner?.email,
        artistName: booking.artist?.username || booking.artist?.email || 'Artist',
        reaction: currentReaction,
        day: booking.day,
        start: booking.start,
        location: booking.location,
        rejectNote: currentReaction === 'rejected' ? booking.rejectNote : null,
      });
    } catch (error) {
      strapi.log.error('Error sending booking response email:', error);
    }
  },
};
