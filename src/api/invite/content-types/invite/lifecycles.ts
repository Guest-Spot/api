/**
 * Invite lifecycle hooks
 * Automatically handle owner assignment without custom controllers
 */

import { InviteType, InviteReaction } from '../../../../interfaces/enums';
import { createArtistAddedNotification } from '../../helpers/createArtistAddedNotification';

export default {
  async beforeUpdate(event) {
    const { where, data } = event.params;

    const currentInvite = await strapi.entityService.findOne('api::invite.invite', where.id);

    // Check if invite type is artist-to-shop
    if (currentInvite && currentInvite.type === InviteType.ARTIST_TO_SHOP) {
      try {
        // Get current shop data to access existing artists
        const shop = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: currentInvite.sender,
          populate: ['childs']
        });

        // Get current artists array or initialize empty array
        const currentArtists = (shop as any).childs ? (shop as any).childs.map((artist: any) => artist.documentId) : [];
        
        if (data.reaction === InviteReaction.ACCEPTED) {
          // Add new artist ID if not already present
          if (!currentArtists.includes(currentInvite.recipient)) {
            currentArtists.push(currentInvite.recipient);
            
            // Update the shop's artists field
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: currentInvite.sender,
              data: {
                childs: currentArtists
              }
            });

            // Create notification for artist addition
            try {
              // Get artist data for notification
              const artist = await strapi.documents('plugin::users-permissions.user').findOne({
                documentId: currentInvite.recipient
              });
              
              if (artist && shop) {
                await createArtistAddedNotification(shop, artist);
              }
            } catch (notificationError) {
              console.error('Error creating artist addition notification:', notificationError);
            }
          }
        } else if (data.reaction === InviteReaction.PENDING || data.reaction === InviteReaction.REJECTED) {
          // Remove artist from shop if invite is pending or rejected
          const updatedArtists = currentArtists.filter((artistDocumentId: string) => artistDocumentId !== currentInvite.recipient);

          // Update the shop's artists field only if there was a change
          if (updatedArtists.length !== currentArtists.length) {
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: currentInvite.sender,
              data: {
                childs: updatedArtists
              }
            });
          }
        }
      } catch (error) {
        console.error('Error updating artist-shop relationship:', error);
      }
    }
  },
};