/**
 * Check if user is artist or shop of the guest spot booking
 */

export default (policyContext, config, { strapi }) => {
  const state = policyContext.state;

  if (!state?.user?.id) return false;

  return new Promise(async (resolve) => {
    try {
      const entityId = policyContext?.args?.id ?? policyContext?.args?.documentId;

      if (!entityId) {
        resolve(false);
        return;
      }

      const booking = await strapi.documents('api::guest-spot-booking.guest-spot-booking').findOne({
        documentId: entityId,
        populate: ['artist', 'shop'],
      });

      if (!booking) {
        resolve(false);
        return;
      }

      const isArtist = (booking.artist as { documentId?: string })?.documentId === state?.user?.documentId;
      const isShop = (booking.shop as { documentId?: string })?.documentId === state?.user?.documentId;

      resolve(isArtist || isShop);
    } catch (error) {
      strapi.log.error('Guest spot booking participant policy error:', error);
      resolve(false);
    }
  });
};
