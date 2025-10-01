export default {
  async beforeUpdate(event) {
    const { data } = event.params;

    if (data?.documentId) {
      const guest = await strapi.documents('api::guest.guest').findOne({
        documentId: data.documentId,
        populate: ['users_permissions_user'],
      });
  
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: guest.users_permissions_user.documentId,
        data: {
          blocked: data.blocked,
        },
      });
    }
  },
};
