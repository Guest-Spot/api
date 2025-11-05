/**
 * Booking participant policy
 * Checks if user is either the owner or the artist of the booking
 */

export default (policyContext, config, { strapi }) => {
  const state = policyContext.state;
  
  // If no user is authenticated, deny access
  if (!state?.user?.id) {
    return false;
  }

  return new Promise(async (resolve) => {
    try {
      const entityId = policyContext?.args?.id || policyContext?.args?.documentId;
      
      if (!entityId) {
        resolve(false);
        return;
      }

      // Find the booking with artist and owner relations
      const booking = await strapi.documents('api::booking.booking').findOne({
        documentId: entityId,
        populate: ['artist', 'owner']
      });

      if (!booking) {
        resolve(false);
        return;
      }

      // Check if user is either the owner or the artist
      const isOwner = booking.owner?.documentId === state?.user?.documentId;
      const isArtist = booking.artist?.documentId === state?.user?.documentId;

      resolve(isOwner || isArtist);
      
    } catch (error) {
      strapi.log.error('Booking participant policy error:', error);
      resolve(false);
    }
  });
};

