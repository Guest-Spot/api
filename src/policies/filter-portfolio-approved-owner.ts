/**
 * Filter portfolio data policy
 * Filters portfolios to show only those where owner.approved === true
 * This filters out portfolios where the owner is not approved
 */

export default async (policyContext) => {
  const { args } = policyContext;

  args.filters = {
    ...args.filters,
    owner: {
      approved: {
        eq: true
      }
    }
  };

  return true;
};
