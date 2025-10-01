import { UserType } from '../../../../interfaces/enums';

export default {
  async beforeUpdate(event) {
    const { documentId, type, blocked } = event.params.data;

    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId,
      populate: ['guest', 'shop', 'artist'],
    });

    if (type === UserType.SHOP) {
      await strapi.documents('api::shop.shop').update({
        documentId: user.shop.documentId,
        data: {
          blocked,
        },
        status: 'published',
      });
    } else if (type === UserType.ARTIST) {
      await strapi.documents('api::artist.artist').update({
        documentId: user.artist.documentId,
        data: {
          blocked,
        },
        status: 'published',
      });
    } else if (type === UserType.GUEST) {
      await strapi.documents('api::guest.guest').update({
        documentId: user.guest.documentId,
        data: {
          blocked,
        },
        status: 'published',
      });
    }
  },
  async afterCreate(event) {
    const { result } = event;
    const { id, type, email, blocked } = result;

    try {
      if (type === UserType.SHOP) {
        // Create shop record and link to user
        const shop = await strapi.entityService.create('api::shop.shop', {
          data: {
            users_permissions_user: id,
            email,
            blocked,
            publishedAt: new Date(), // For draft & publish
          },
          status: 'published',
        });

        strapi.log.info(`Shop created for user ${id}: ${shop.id}`);
      } else if (type === UserType.ARTIST) {
        // Create artist record and link to user
        const artist = await strapi.entityService.create('api::artist.artist', {
          data: {
            users_permissions_user: id,
            email,
            blocked,
            publishedAt: new Date(), // For draft & publish
          },
          status: 'published',
        });

        strapi.log.info(`Artist created for user ${id}: ${artist.id}`);
      } else if (type === UserType.GUEST) {
        // Create guest record and link to user
        const guest = await strapi.entityService.create('api::guest.guest', {
          data: {
            users_permissions_user: id,
            email,
            blocked,
            publishedAt: new Date(), // For draft & publish
          },
          status: 'published',
        });

        strapi.log.info(`Guest created for user ${id}: ${guest.id}`);
      }
    } catch (error) {
      strapi.log.error('Error creating shop/artist/guest for new user:', error);
      // Don't throw error to avoid breaking user creation
    }
  },
};
