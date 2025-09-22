/**
 * Invite lifecycle hooks
 * Automatically handle owner assignment without custom controllers
 */

export default {
  // Before creating a invite, automatically set the owner
  async beforeCreate(event) {
    const { data } = event.params;

    // Check if invite type is artist-to-shop
    if (data.type === 'artist_to_shop') {
      try {
        // Get current shop data to access existing artists
        const shop = await strapi.documents('api::shop.shop').findOne({
          documentId: data.sender,
          populate: ['artists']
        });

        // Get current artists array or initialize empty array
        const currentArtists = (shop as any).artists ? (shop as any).artists.map((artist: any) => artist.id) : [];
        
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
      } catch (error) {
        console.error('Error linking artist to shop:', error);
      }
    }
  },
};
