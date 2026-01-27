/**
 * Filter guest spot bookings to those where user is artist or shop
 */

export default async (policyContext) => {
  const { state, args } = policyContext;

  if (!state?.user?.documentId) return false;

  const baseFilters = {
    ...args.filters,
    or: [
      { artist: { documentId: { eq: state.user.documentId } } },
      { shop: { documentId: { eq: state.user.documentId } } },
    ],
  };

  args.filters = baseFilters;
  return true;
};
