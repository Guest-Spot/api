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
    return booking;
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
