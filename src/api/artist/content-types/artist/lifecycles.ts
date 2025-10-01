/**
 * Artist lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

import isAdmin from '../../../../utils/isAdmin';

export default {
  // Before updating, prevent changing the user (except from admin panel)
  async beforeUpdate(event) {
    const { data } = event.params;
    
    if (data?.documentId) {
      const artist = await strapi.documents('api::artist.artist').findOne({
        documentId: data.documentId,
        populate: ['users_permissions_user'],
      });
  
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: artist.users_permissions_user.documentId,
        data: {
          blocked: data.blocked,
        },
      });
    }

    // Only prevent changing the user if request is NOT from admin panel
    if (!isAdmin() && data.users_permissions_user) {
      delete data.users_permissions_user;
    }
  }
};
