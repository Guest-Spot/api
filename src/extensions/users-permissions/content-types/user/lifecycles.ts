export default {
  async afterCreate(event) {
    const { result } = event;
    const { id, type, email } = result;

    try {
      if (type === 'shop') {
        // Create shop record and link to user
        const shop = await strapi.entityService.create('api::shop.shop', {
          data: {
            users_permissions_user: id,
            name: 'N/A',
            email: email,
            publishedAt: new Date(), // For draft & publish
          },
          status: 'published',
        });

        strapi.log.info(`Shop created for user ${id}: ${shop.id}`);
      } else if (type === 'artist') {
        // Create artist record and link to user
        const artist = await strapi.entityService.create('api::artist.artist', {
          data: {
            users_permissions_user: id,
            name: 'N/A',
            email: email,
            publishedAt: new Date(), // For draft & publish
          },
          status: 'published',
        });

        strapi.log.info(`Artist created for user ${id}: ${artist.id}`);
      }
    } catch (error) {
      strapi.log.error('Error creating shop/artist for new user:', error);
      // Don't throw error to avoid breaking user creation
    }
  },
};
