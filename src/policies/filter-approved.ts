export default async (policyContext) => {
  const { args } = policyContext;

  args.filters = {
    ...args.filters,
    approved: { eq: true },
  };

  return true;
};
