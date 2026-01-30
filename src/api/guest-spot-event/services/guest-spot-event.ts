/**
 * guest-spot-event service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::guest-spot-event.guest-spot-event', ({ strapi }) => ({
  /**
   * Create and publish a guest spot event (publishedAt set automatically)
   */
  async createAndPublish(data: {
    type: string;
    title: string;
    description: string;
    shop: string;
    artist?: string;
    slot?: string;
    booking?: string;
  }) {
    const payload: Record<string, unknown> = {
      type: data.type,
      title: data.title,
      description: data.description,
      shop: { connect: [{ documentId: data.shop }] },
    };
    if (data.artist) payload.artist = { connect: [{ documentId: data.artist }] };
    if (data.slot) payload.slot = { connect: [{ documentId: data.slot }] };
    if (data.booking) payload.booking = { connect: [{ documentId: data.booking }] };

    const created = await strapi.documents('api::guest-spot-event.guest-spot-event').create({
      data: payload as any,
      status: 'published',
    });
    return created;
  },
}));
