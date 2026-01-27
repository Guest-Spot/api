/**
 * GraphQL extension for Guest Spot (slots, bookings, events, deposits)
 */

export const guestSpotExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    type ToggleGuestSpotEnabledResult {
      documentId: ID!
      guestSpotEnabled: Boolean!
    }

    type GuestSpotDepositSession {
      booking: GuestSpotBookingEntityResponse
      sessionId: String!
      sessionUrl: String
      paymentIntentId: String!
    }

    input GuestSpotEventCreateInput {
      type: String!
      title: String!
      description: String!
      shopDocumentId: ID!
      artistDocumentId: ID
      guestSpotSlotDocumentId: ID
      guestSpotBookingDocumentId: ID
    }

    extend type Mutation {
      toggleGuestSpotEnabled(shopDocumentId: ID!, enabled: Boolean!): ToggleGuestSpotEnabledResult!
      approveGuestSpotBooking(documentId: ID!): GuestSpotBookingEntityResponse!
      rejectGuestSpotBooking(documentId: ID!, rejectNote: String): GuestSpotBookingEntityResponse!
      createGuestSpotDeposit(bookingId: ID!, customerEmail: String): GuestSpotDepositSession!
      captureGuestSpotDeposit(bookingId: ID!): GuestSpotBookingEntityResponse!
      releaseGuestSpotDeposit(bookingId: ID!): GuestSpotBookingEntityResponse!
      publishGuestSpotEvent(data: GuestSpotEventCreateInput!): GuestSpotEventEntityResponse!
    }
  `,
  resolvers: {
    Mutation: {
      async createGuestSpotSlot(parent, args, context) {
        const userId = context.state?.user?.id;
        const userDocId = context.state?.user?.documentId;
        if (!userId || !userDocId) throw new Error('UNAUTHORIZED');
        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: userDocId,
        });
        if (!user) throw new Error('UNAUTHORIZED');
        if ((user as { type?: string }).type !== 'shop') throw new Error('FORBIDDEN: Only shops can create slots');
        if (!(user as { guestSpotEnabled?: boolean }).guestSpotEnabled) {
          throw new Error('BUSINESS_LOGIC_ERROR: Enable Guest Spot for your shop first');
        }
        const slot = await strapi.service('api::guest-spot-slot.guest-spot-slot').createSlotWithEvent(
          userDocId,
          args.data
        );
        return { data: slot };
      },
      async updateGuestSpotSlot(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          const slot = await strapi.service('api::guest-spot-slot.guest-spot-slot').updateSlotWithEvent(
            args.documentId,
            args.data,
            userDocId
          );
          return { data: slot };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async deleteGuestSpotSlot(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          await strapi.service('api::guest-spot-slot.guest-spot-slot').deleteSlot(
            args.documentId,
            userDocId
          );
          return { data: { documentId: args.documentId } };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async toggleGuestSpotEnabled(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        if (args.shopDocumentId !== userDocId) throw new Error('FORBIDDEN');
        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: args.shopDocumentId,
        });
        if (!user) throw new Error('NOT_FOUND');
        await strapi.documents('plugin::users-permissions.user').update({
          documentId: args.shopDocumentId,
          data: { guestSpotEnabled: args.enabled },
        });
        return { documentId: args.shopDocumentId, guestSpotEnabled: args.enabled };
      },
      async createGuestSpotBooking(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: userDocId,
        });
        if (!user) throw new Error('UNAUTHORIZED');
        if ((user as { type?: string }).type !== 'artist') throw new Error('FORBIDDEN: Only artists can create bookings');
        try {
          const booking = await strapi
            .service('api::guest-spot-booking.guest-spot-booking')
            .createBookingWithEvent(args.data, userDocId);
          return { data: booking };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          throw e;
        }
      },
      async approveGuestSpotBooking(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          const booking = await strapi
            .service('api::guest-spot-booking.guest-spot-booking')
            .approveBooking(args.documentId, userDocId);
          return { data: booking };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async rejectGuestSpotBooking(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          const booking = await strapi
            .service('api::guest-spot-booking.guest-spot-booking')
            .rejectBooking(args.documentId, args.rejectNote ?? undefined, userDocId);
          return { data: booking };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async createGuestSpotDeposit(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          const result = await strapi
            .service('api::guest-spot-booking.guest-spot-booking')
            .createDepositSession(args.bookingId, args.customerEmail ?? undefined, userDocId);
          return {
            booking: result.booking ? { data: result.booking } : null,
            sessionId: result.sessionId,
            sessionUrl: result.sessionUrl,
            paymentIntentId: result.paymentIntentId,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async captureGuestSpotDeposit(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          const booking = await strapi
            .service('api::guest-spot-booking.guest-spot-booking')
            .captureDeposit(args.bookingId, userDocId);
          return { data: booking };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async releaseGuestSpotDeposit(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        try {
          const booking = await strapi
            .service('api::guest-spot-booking.guest-spot-booking')
            .releaseDeposit(args.bookingId, userDocId);
          return { data: booking };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          if (msg === 'NOT_FOUND') throw new Error('NOT_FOUND');
          if (msg === 'FORBIDDEN') throw new Error('FORBIDDEN');
          throw e;
        }
      },
      async publishGuestSpotEvent(parent, args, context) {
        const userDocId = context.state?.user?.documentId;
        if (!userDocId) throw new Error('UNAUTHORIZED');
        const d = args.data as {
          type: string;
          title: string;
          description: string;
          shopDocumentId: string;
          artistDocumentId?: string;
          guestSpotSlotDocumentId?: string;
          guestSpotBookingDocumentId?: string;
        };
        const created = await strapi
          .service('api::guest-spot-event.guest-spot-event')
          .createAndPublish({
            type: d.type,
            title: d.title,
            description: d.description,
            shop: d.shopDocumentId,
            artist: d.artistDocumentId,
            slot: d.guestSpotSlotDocumentId,
            booking: d.guestSpotBookingDocumentId,
          });
        return { data: created };
      },
    },
  },
  resolversConfig: {
    'Mutation.createGuestSpotSlot': { auth: true },
    'Mutation.updateGuestSpotSlot': { auth: true },
    'Mutation.deleteGuestSpotSlot': { auth: true },
    'Mutation.toggleGuestSpotEnabled': { auth: true },
    'Mutation.createGuestSpotBooking': { auth: true },
    'Mutation.approveGuestSpotBooking': { auth: true },
    'Mutation.rejectGuestSpotBooking': { auth: true },
    'Mutation.createGuestSpotDeposit': { auth: true },
    'Mutation.captureGuestSpotDeposit': { auth: true },
    'Mutation.releaseGuestSpotDeposit': { auth: true },
    'Mutation.publishGuestSpotEvent': { auth: true },
  },
});

