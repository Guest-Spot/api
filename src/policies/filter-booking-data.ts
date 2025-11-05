/**
 * Filter booking data policy
 * Filters bookings to show only those where the user is owner or artist
 * This is a specialized version for entities with relation fields
 */

export default async (policyContext) => {
  const { state, args } = policyContext;

  if (!state?.user?.documentId) return false;

  const user = await strapi.query('plugin::users-permissions.user').findOne({
    where: { documentId: state.user.documentId },
    select: ['type', 'payoutsEnabled', 'documentId']
  });

  if (!user) return false;

  // Add filter to show only bookings where user is owner or artist
  const baseFilters = {
    ...args.filters,
    or: [
      {
        owner: {
          documentId: {
            eq: state.user.documentId
          }
        }
      },
      {
        artist: {
          documentId: {
            eq: state.user.documentId
          }
        }
      }
    ],
  };

  if (user.type === 'artist' && user.payoutsEnabled === true) {
    // Exclude bookings with reaction = pending AND paymentStatus = unpaid
    args.filters = {
      ...baseFilters,
      and: [
        {
          or: [
            {
              reaction: {
                ne: 'pending'
              }
            },
            {
              paymentStatus: {
                ne: 'unpaid'
              }
            }
          ]
        }
      ]
    };
  } else {
    // For other users or artists with payoutsEnabled = false, use base filters only
    args.filters = baseFilters;
  }
  
  return true;
};

