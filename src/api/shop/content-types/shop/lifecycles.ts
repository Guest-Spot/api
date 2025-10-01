/**
 * Shop lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

import isAdmin from '../../../../utils/isAdmin';
import { processArtistRemoval } from '../../helpers/createArtistRemovedNotification';
import { processArtistAddition } from '../../helpers/createArtistAddedNotification';


export default {
  // Before updating, prevent changing the user (except from admin panel)
  async beforeUpdate(event) {
    const { data, where } = event.params;

    if (data?.documentId) {
      const shop = await strapi.documents('api::shop.shop').findOne({
        documentId: data.documentId,
        populate: ['users_permissions_user'],
      });
  
      if (shop?.users_permissions_user?.documentId) {
        await strapi.documents('plugin::users-permissions.user').update({
          documentId: shop.users_permissions_user.documentId,
          data: {
            blocked: data.blocked,
          },
        });
      }
    }

    // Only prevent changing the user if request is NOT from admin panel
    if (!isAdmin() && data.users_permissions_user) {
      delete data.users_permissions_user;
    }

    // Process artist removal and create notifications
    await processArtistRemoval(data, where);
    
    // Process artist addition and create notifications
    await processArtistAddition(data, where);
  }
};
