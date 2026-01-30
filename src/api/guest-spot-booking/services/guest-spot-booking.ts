/**
 * guest-spot-booking service
 */

import { factories } from '@strapi/strapi';
import {
  createGuestSpotDepositCheckoutSession,
  capturePaymentIntent,
  cancelPaymentIntent,
  getDefaultCurrency,
  isStripeEnabled,
} from '../../../utils/stripe';
import { calculatePlatformFee, getPlatformFeePercent } from '../../../utils/stripe';
import { createNotification } from '../../../utils/notification';
import { sendGuestSpotBookingRequestEmail } from '../../../utils/email/guest-spot-booking-request';
import { sendGuestSpotBookingResponseEmail } from '../../../utils/email/guest-spot-booking-response';
import { sendFirebaseNotificationToUser } from '../../../utils/push-notification';
import { NotifyType } from '../../../interfaces/enums';

export default factories.createCoreService('api::guest-spot-booking.guest-spot-booking', ({ strapi }) => ({
  async createBookingWithEvent(
    data: {
      guestSpotSlotDocumentId: string;
      selectedDate: string;
      selectedTime?: string;
      comment?: string;
      platformCommissionAmount?: number;
    },
    artistDocumentId: string
  ) {
    const slot = await strapi.documents('api::guest-spot-slot.guest-spot-slot').findOne({
      documentId: data.guestSpotSlotDocumentId,
      populate: ['shop'],
    });
    if (!slot) throw new Error('NOT_FOUND');
    if (!slot.enabled) throw new Error('BUSINESS_LOGIC_ERROR: Slot is disabled');
    const shop = slot.shop as { documentId?: string; guestSpotEnabled?: boolean } | null;
    if (!shop?.documentId) throw new Error('BUSINESS_LOGIC_ERROR: Slot has no shop');
    const shopUser = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: shop.documentId,
    });
    if (!(shopUser as { guestSpotEnabled?: boolean })?.guestSpotEnabled) {
      throw new Error('BUSINESS_LOGIC_ERROR: Shop has Guest Spot disabled');
    }
    const conflict = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findMany({
      filters: {
        slot: { documentId: { $eq: data.guestSpotSlotDocumentId } },
        status: { $in: ['pending', 'accepted'] },
        selectedDate: { $eq: data.selectedDate },
      },
    });
    if (Array.isArray(conflict) && conflict.length > 0) {
      throw new Error('BUSINESS_LOGIC_ERROR: Date/time already booked');
    }
    let platformCommissionAmount = data.platformCommissionAmount;
    if (platformCommissionAmount == null || !Number.isFinite(platformCommissionAmount)) {
      const pct = await getPlatformFeePercent();
      platformCommissionAmount = calculatePlatformFee((slot as { depositAmount: number }).depositAmount, pct);
    }
    const depositAmount = (slot as { depositAmount: number }).depositAmount;
    const payload = {
      slot: { connect: [{ documentId: data.guestSpotSlotDocumentId }] },
      artist: { connect: [{ documentId: artistDocumentId }] },
      shop: { connect: [{ documentId: shop.documentId }] },
      status: 'pending',
      selectedDate: data.selectedDate,
      selectedTime: data.selectedTime ?? null,
      comment: data.comment ?? null,
      depositAmount,
      platformCommissionAmount,
      platformCommissionPaid: false,
      depositAuthorized: false,
      depositCaptured: false,
    };
    const booking = await strapi.documents('api::guest-spot-booking.guest-spot-booking').create({
      data: payload as any,
      populate: ['slot', 'artist', 'shop'],
    });
    await strapi.service('api::guest-spot-event.guest-spot-event').createAndPublish({
      type: 'booking_created',
      title: 'Guest spot booking created',
      description: `New booking for ${data.selectedDate}${data.selectedTime ? ` at ${data.selectedTime}` : ''}`,
      shop: shop.documentId,
      artist: artistDocumentId,
      slot: data.guestSpotSlotDocumentId,
      booking: booking.documentId,
    });

    // Notify shop: in-app, email (if email set), push (if user id and device tokens)
    const shopUserWithId = shopUser as { id?: number; email?: string; name?: string; username?: string };
    let shopUserId: number | null =
      typeof shopUserWithId.id === 'number' ? shopUserWithId.id : null;
    if (shopUserId === null) {
      const row = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { documentId: shop.documentId },
        select: ['id'],
      });
      shopUserId = typeof row?.id === 'number' ? row.id : null;
    }

    let artistName = 'Artist';
    let artistUserForEmail: { email?: string; description?: string; city?: string; link?: string } | null = null;
    try {
      const artistUser = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: artistDocumentId,
      });
      if (artistUser && typeof artistUser === 'object') {
        const a = artistUser as { name?: string; contactName?: string; username?: string; email?: string; description?: string; city?: string; link?: string };
        artistName = a.name?.trim() || a.contactName?.trim() || a.username?.trim() || a.email?.trim() || artistName;
        artistUserForEmail = { email: a.email, description: a.description, city: a.city, link: a.link };
      }
    } catch {
      // keep default artistName
    }

    try {
      await createNotification({
        ownerDocumentId: artistDocumentId,
        recipientDocumentId: shop.documentId,
        type: NotifyType.GUEST_SPOT_BOOKING_CREATED,
        body: booking,
      });
    } catch (err) {
      strapi.log.error('Error creating in-app notification for guest spot booking:', err);
    }

    if (shopUserWithId.email?.trim()) {
      try {
        await sendGuestSpotBookingRequestEmail({
          shopEmail: shopUserWithId.email.trim(),
          shopName: shopUserWithId.name ?? shopUserWithId.username ?? null,
          artistName,
          artistEmail: artistUserForEmail?.email ?? null,
          artistDescription: artistUserForEmail?.description ?? null,
          artistCity: artistUserForEmail?.city ?? null,
          artistLink: artistUserForEmail?.link ?? null,
          selectedDate: data.selectedDate,
          selectedTime: data.selectedTime ?? null,
          slotTitle: (slot as { title?: string })?.title ?? null,
          comment: data.comment ?? null,
          bookingDocumentId: booking.documentId,
        });
      } catch (err) {
        strapi.log.error('Error sending guest spot booking request email to shop:', err);
      }
    }

    if (shopUserId !== null) {
      try {
        const dateParts: string[] = [];
        if (data.selectedDate) {
          try {
            const d = new Date(`${data.selectedDate.trim()}T00:00:00Z`);
            if (!Number.isNaN(d.getTime())) {
              dateParts.push(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d));
            }
            if (data.selectedTime) dateParts.push(`at ${data.selectedTime}`);
          } catch {
            dateParts.push(data.selectedDate);
            if (data.selectedTime) dateParts.push(data.selectedTime);
          }
        }
        const bodyText = dateParts.length
          ? `${artistName} requested a guest spot slot on ${dateParts.join(' ')}.`
          : `${artistName} requested a guest spot slot.`;
        await sendFirebaseNotificationToUser(shopUserId, {
          title: 'New guest spot request',
          body: bodyText,
          data: {
            notifyType: NotifyType.GUEST_SPOT_BOOKING_CREATED,
            bookingDocumentId: booking.documentId ?? undefined,
          },
        });
      } catch (err) {
        strapi.log.error('Error sending push notification for guest spot booking to shop:', err);
      }
    }

    return booking;
  },

  /**
   * Notify artist (in-app, push, email) when shop accepts or rejects a guest spot booking.
   */
  async notifyArtistOfGuestSpotResponse(
    updated: { documentId?: string; artist?: unknown; shop?: unknown; slot?: unknown; selectedDate?: string; selectedTime?: string | null; rejectNote?: string | null },
    reaction: 'accepted' | 'rejected',
  ): Promise<void> {
    const artist = updated.artist as { documentId?: string } | null;
    const shop = updated.shop as { documentId?: string } | null;
    const slot = updated.slot as { title?: string } | null;
    const artistDocId = artist?.documentId;
    const shopDocId = shop?.documentId;
    if (!artistDocId || !shopDocId) return;

    let artistUserId: number | null = null;
    let artistEmail: string | null = null;
    try {
      const artistRow = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { documentId: artistDocId },
        select: ['id', 'email', 'name', 'username'],
      });
      if (artistRow) {
        artistUserId = typeof artistRow.id === 'number' ? artistRow.id : null;
        artistEmail = typeof artistRow.email === 'string' ? artistRow.email : null;
      }
    } catch {
      // skip notifications if we cannot load artist
    }

    let shopName: string | null = null;
    try {
      const shopUser = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: shopDocId,
      });
      if (shopUser && typeof shopUser === 'object') {
        const s = shopUser as { name?: string; username?: string };
        shopName = s.name?.trim() || s.username?.trim() || 'Shop';
      }
    } catch {
      shopName = 'Shop';
    }

    const notifyType = reaction === 'accepted' ? NotifyType.GUEST_SPOT_BOOKING_ACCEPTED : NotifyType.GUEST_SPOT_BOOKING_REJECTED;

    try {
      await createNotification({
        ownerDocumentId: shopDocId,
        recipientDocumentId: artistDocId,
        type: notifyType,
        body: updated,
      });
    } catch (err) {
      strapi.log.error('Error creating in-app notification for guest spot response to artist:', err);
    }

    const dateParts: string[] = [];
    if (updated.selectedDate) {
      try {
        const d = new Date(`${String(updated.selectedDate).trim()}T00:00:00Z`);
        if (!Number.isNaN(d.getTime())) {
          dateParts.push(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d));
        }
        if (updated.selectedTime) dateParts.push(`at ${updated.selectedTime}`);
      } catch {
        dateParts.push(updated.selectedDate);
        if (updated.selectedTime) dateParts.push(updated.selectedTime);
      }
    }
    let bodyText = dateParts.length
      ? `${shopName} ${reaction === 'accepted' ? 'accepted' : 'rejected'} your guest spot request for ${dateParts.join(' ')}.`
      : `${shopName} ${reaction === 'accepted' ? 'accepted' : 'rejected'} your guest spot request.`;
    if (reaction === 'rejected' && updated.rejectNote?.trim()) {
      bodyText += ` Reason: ${updated.rejectNote.trim()}`;
    }

    if (artistUserId !== null) {
      try {
        await sendFirebaseNotificationToUser(artistUserId, {
          title: reaction === 'accepted' ? 'Guest spot request accepted' : 'Guest spot request rejected',
          body: bodyText,
          data: {
            notifyType,
            bookingDocumentId: updated.documentId ?? undefined,
          },
        });
      } catch (err) {
        strapi.log.error('Error sending push notification for guest spot response to artist:', err);
      }
    }

    if (artistEmail?.trim()) {
      try {
        await sendGuestSpotBookingResponseEmail({
          artistEmail: artistEmail.trim(),
          shopName: shopName ?? undefined,
          reaction,
          selectedDate: updated.selectedDate ?? undefined,
          selectedTime: updated.selectedTime ?? undefined,
          slotTitle: slot?.title ?? undefined,
          rejectNote: reaction === 'rejected' ? (updated.rejectNote ?? undefined) : undefined,
          bookingDocumentId: updated.documentId ?? undefined,
        });
      } catch (err) {
        strapi.log.error('Error sending guest spot response email to artist:', err);
      }
    }
  },

  async approveBooking(documentId: string, userDocumentId: string) {
    const b = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
      documentId,
      populate: ['slot', 'artist', 'shop'],
    });
    if (!b) throw new Error('NOT_FOUND');
    const shop = b.shop as { documentId?: string } | null;
    if (shop?.documentId !== userDocumentId) throw new Error('FORBIDDEN');
    if (b.status !== 'pending') throw new Error('BUSINESS_LOGIC_ERROR: Booking is not pending');
    const updated = await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
      documentId,
      data: { status: 'accepted' },
      populate: ['slot', 'artist', 'shop'],
    });
    const artist = b.artist as { documentId?: string } | null;
    const slot = b.slot as { documentId?: string } | null;
    await strapi.service('api::guest-spot-event.guest-spot-event').createAndPublish({
      type: 'booking_accepted',
      title: 'Guest spot booking accepted',
      description: 'Booking has been accepted',
      shop: shop!.documentId!,
      artist: artist?.documentId,
      slot: slot?.documentId,
      booking: documentId,
    });
    try {
      const svc = strapi.service('api::guest-spot-booking.guest-spot-booking') as { notifyArtistOfGuestSpotResponse: (u: unknown, r: 'accepted' | 'rejected') => Promise<void> };
      await svc.notifyArtistOfGuestSpotResponse(updated, 'accepted');
    } catch (err) {
      strapi.log.error('Error notifying artist of guest spot approval:', err);
    }
    return updated;
  },

  async rejectBooking(documentId: string, rejectNote: string | undefined, userDocumentId: string) {
    const b = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
      documentId,
      populate: ['slot', 'artist', 'shop'],
    });
    if (!b) throw new Error('NOT_FOUND');
    const shop = b.shop as { documentId?: string } | null;
    if (shop?.documentId !== userDocumentId) throw new Error('FORBIDDEN');
    if (b.status !== 'pending') throw new Error('BUSINESS_LOGIC_ERROR: Booking is not pending');
    const updated = await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
      documentId,
      data: { status: 'rejected', rejectNote: rejectNote ?? null },
      populate: ['slot', 'artist', 'shop'],
    });
    const artist = b.artist as { documentId?: string } | null;
    const slot = b.slot as { documentId?: string } | null;
    await strapi.service('api::guest-spot-event.guest-spot-event').createAndPublish({
      type: 'booking_rejected',
      title: 'Guest spot booking rejected',
      description: rejectNote || 'Booking was rejected',
      shop: shop!.documentId!,
      artist: artist?.documentId,
      slot: slot?.documentId,
      booking: documentId,
    });
    try {
      const svc = strapi.service('api::guest-spot-booking.guest-spot-booking') as { notifyArtistOfGuestSpotResponse: (u: unknown, r: 'accepted' | 'rejected') => Promise<void> };
      await svc.notifyArtistOfGuestSpotResponse(updated, 'rejected');
    } catch (err) {
      strapi.log.error('Error notifying artist of guest spot rejection:', err);
    }
    return updated;
  },

  async createDepositSession(
    bookingDocumentId: string,
    customerEmail: string | undefined,
    userDocumentId: string
  ) {
    const enabled = await isStripeEnabled();
    if (!enabled) throw new Error('Stripe payments are disabled');
    const b = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
      documentId: bookingDocumentId,
      populate: ['artist', 'shop'],
    });
    if (!b) throw new Error('NOT_FOUND');
    if (b.status !== 'accepted') throw new Error('BUSINESS_LOGIC_ERROR: Booking must be accepted');
    if (b.depositAuthorized) throw new Error('BUSINESS_LOGIC_ERROR: Deposit already authorized');
    const artistDocId = (b.artist as { documentId?: string })?.documentId;
    if (artistDocId !== userDocumentId) throw new Error('FORBIDDEN');
    const email = customerEmail || (b.artist as { email?: string })?.email;
    const { sessionId, sessionUrl, paymentIntentId } = await createGuestSpotDepositCheckoutSession({
      guestSpotBookingDocumentId: bookingDocumentId,
      amount: b.depositAmount,
      currency: getDefaultCurrency(),
      customerEmail: email,
    });
    await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
      documentId: bookingDocumentId,
      data: { paymentIntentId },
    });
    return { booking: b, sessionId, sessionUrl, paymentIntentId };
  },

  async captureDeposit(bookingDocumentId: string, userDocumentId: string) {
    const enabled = await isStripeEnabled();
    if (!enabled) throw new Error('Stripe payments are disabled');
    const b = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
      documentId: bookingDocumentId,
      populate: ['shop'],
    });
    if (!b) throw new Error('NOT_FOUND');
    if ((b.shop as { documentId?: string })?.documentId !== userDocumentId) throw new Error('FORBIDDEN');
    if (!b.depositAuthorized) throw new Error('BUSINESS_LOGIC_ERROR: Deposit not authorized');
    if (b.depositCaptured) throw new Error('BUSINESS_LOGIC_ERROR: Deposit already captured');
    if (!b.paymentIntentId) throw new Error('BUSINESS_LOGIC_ERROR: No payment intent');
    await capturePaymentIntent(b.paymentIntentId);
    const updated = await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
      documentId: bookingDocumentId,
      data: { depositCaptured: true, platformCommissionPaid: true },
      populate: ['slot', 'artist', 'shop'],
    });
    return updated;
  },

  async releaseDeposit(bookingDocumentId: string, userDocumentId: string) {
    const enabled = await isStripeEnabled();
    if (!enabled) throw new Error('Stripe payments are disabled');
    const b = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
      documentId: bookingDocumentId,
      populate: ['shop'],
    });
    if (!b) throw new Error('NOT_FOUND');
    if ((b.shop as { documentId?: string })?.documentId !== userDocumentId) throw new Error('FORBIDDEN');
    if (!b.depositAuthorized) throw new Error('BUSINESS_LOGIC_ERROR: Deposit not authorized');
    if (b.depositCaptured) throw new Error('BUSINESS_LOGIC_ERROR: Cannot release captured deposit');
    if (!b.paymentIntentId) throw new Error('BUSINESS_LOGIC_ERROR: No payment intent');
    await cancelPaymentIntent(b.paymentIntentId);
    const updated = await strapi.documents('api::guest-spot-booking.guest-spot-booking').update({
      documentId: bookingDocumentId,
      data: { depositAuthorized: false },
      populate: ['slot', 'artist', 'shop'],
    });
    return updated;
  },
}));
