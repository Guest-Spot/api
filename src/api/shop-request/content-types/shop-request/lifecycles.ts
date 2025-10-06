/**
 * Shop lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

export default {
  // Before updating, prevent changing the user (except from admin panel)
  async afterCreate(event) {
    const { data } = event.params;

    if (data?.documentId) {
      await strapi.documents('api::shop-request.shop-request').update({
        documentId: data.documentId,
        data: {
          tempPassword: Math.random().toString(36).substring(2, 7),
        },
      });
    }
  },
};
