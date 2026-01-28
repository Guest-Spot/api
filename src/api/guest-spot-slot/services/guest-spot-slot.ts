/**
 * guest-spot-slot service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::guest-spot-slot.guest-spot-slot', ({ strapi }) => ({
  async createSlotWithEvent(
    shopDocumentId: string,
    data: {
      enabled?: boolean;
      title?: string;
      description: string;
      pricingOptions: unknown;
      depositAmount: number;
      spaces: number;
      openingHours: unknown;
    }
  ) {
    const payload = {
      enabled: data.enabled ?? true,
      title: data.title,
      description: data.description,
      pricingOptions: data.pricingOptions,
      depositAmount: data.depositAmount,
      spaces: data.spaces,
      openingHours: data.openingHours,
      shop: { connect: [{ documentId: shopDocumentId }] },
    };
    const slot = await strapi.documents('api::guest-spot-slot.guest-spot-slot').create({
      data: payload as any,
      populate: ['shop'],
    });
    await strapi.service('api::guest-spot-event.guest-spot-event').createAndPublish({
      type: 'slot_opened',
      title: 'Guest spot slot opened',
      description: (data.description as string) || 'New guest spot slot',
      shop: shopDocumentId,
      slot: slot.documentId,
    });
    return slot;
  },

  async updateSlotWithEvent(
    documentId: string,
    data: Partial<{
      enabled: boolean;
      title: string;
      description: string;
      pricingOptions: unknown;
      depositAmount: number;
      spaces: number;
      openingHours: unknown;
    }>,
    userDocumentId: string
  ) {
    const slot = await strapi.documents('api::guest-spot-slot.guest-spot-slot').findOne({
      documentId,
      populate: ['shop'],
    });
    if (!slot) throw new Error('NOT_FOUND');
    if (slot.shop?.documentId !== userDocumentId) throw new Error('FORBIDDEN');
    const payload: Record<string, unknown> = {};
    if (data.enabled !== undefined) payload.enabled = data.enabled;
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description;
    if (data.pricingOptions !== undefined) payload.pricingOptions = data.pricingOptions;
    if (data.depositAmount !== undefined) payload.depositAmount = data.depositAmount;
    if (data.spaces !== undefined) payload.spaces = data.spaces;
    if (data.openingHours !== undefined) payload.openingHours = data.openingHours;
    const updated = await strapi.documents('api::guest-spot-slot.guest-spot-slot').update({
      documentId,
      data: payload,
      populate: ['shop'],
    });
    await strapi.service('api::guest-spot-event.guest-spot-event').createAndPublish({
      type: 'slot_updated',
      title: 'Guest spot slot updated',
      description: (data.description as string) || (slot.description as string) || 'Slot updated',
      shop: (slot.shop?.documentId as string) ?? userDocumentId,
      slot: documentId,
    });
    return updated;
  },

  async deleteSlot(documentId: string, userDocumentId: string) {
    const slot = await strapi.documents('api::guest-spot-slot.guest-spot-slot').findOne({
      documentId,
      populate: ['shop'],
    });
    if (!slot) throw new Error('NOT_FOUND');
    if (slot.shop?.documentId !== userDocumentId) throw new Error('FORBIDDEN');
    const active = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findMany({
      filters: {
        slot: { documentId: { $eq: documentId } },
        status: { $in: ['pending', 'accepted'] },
      },
    });
    if (Array.isArray(active) && active.length > 0) {
      throw new Error('BUSINESS_LOGIC_ERROR: Cannot delete slot with active bookings');
    }
    return strapi.documents('api::guest-spot-slot.guest-spot-slot').delete({ documentId });
  },
}));
