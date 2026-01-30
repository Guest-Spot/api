/**
 * Filter guest spot bookings to those where user is artist or shop.
 * Shop sees only: no-deposit bookings (depositAmount === 0) or paid-deposit bookings (depositAuthorized === true).
 */

export default async (policyContext) => {
  const { state, args } = policyContext;

  if (!state?.user?.documentId) return false;

  args.filters = {
    ...args.filters,
    or: [
      { artist: { documentId: { eq: state.user.documentId } } },
      {
        and: [
          { shop: { documentId: { eq: state.user.documentId } } },
          {
            or: [
              { depositAmount: { eq: 0 } },
              { depositAuthorized: { eq: true } },
            ],
          },
        ],
      },
    ],
  };
  return true;
};
