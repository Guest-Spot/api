/**
 * Invite lifecycle hooks
 * Automatically handle owner assignment without custom controllers
 */

import { InviteType, InviteReaction } from '../../../../interfaces/enums';

export default {
  async beforeUpdate(event) {
    const { data } = event.params;

    // Check if invite type is artist-to-shop
    if (data.type === InviteType.ARTIST_TO_SHOP) {
      try {
        // Get current shop data to access existing artists
        const shop = await strapi.documents('api::shop.shop').findOne({
          documentId: data.sender,
          populate: ['artists']
        });

        // Get current artists array or initialize empty array
        const currentArtists = (shop as any).artists ? (shop as any).artists.map((artist: any) => artist.documentId) : [];
        
        if (data.reaction === InviteReaction.ACCEPTED) {
          // Add new artist ID if not already present
          if (!currentArtists.includes(data.recipient)) {
            currentArtists.push(data.recipient);
            
            // Update the shop's artists field
            await strapi.documents('api::shop.shop').update({
              documentId: data.sender,
              data: {
                artists: currentArtists
              }
            });
          }
        } else if (data.reaction === InviteReaction.PENDING || data.reaction === InviteReaction.REJECTED) {
          // Remove artist from shop if invite is pending or rejected
          const updatedArtists = currentArtists.filter((artistDocumentId: string) => artistDocumentId !== data.recipient);

          // Update the shop's artists field only if there was a change
          if (updatedArtists.length !== currentArtists.length) {
            await strapi.documents('api::shop.shop').update({
              documentId: data.sender,
              data: {
                artists: updatedArtists
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
