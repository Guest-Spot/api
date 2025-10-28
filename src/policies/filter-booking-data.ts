/**
 * Filter booking data policy
 * Filters bookings to show only those where the user is owner or artist
 * This is a specialized version for entities with relation fields
 */

export default async (policyContext) => {
  const { state, args } = policyContext;

  if (!state?.user?.documentId) return false;

  // Add filter to show only bookings where user is owner or artist
  args.filters = {
    ...args.filters,
    $or: [
      {
        owner: {
          documentId: {
            $eq: state.user.documentId
          }
        }
      },
      {
        artist: {
          documentId: {
            $eq: state.user.documentId
          }
        }
      }
    ],
  };
  
  return true;
};

