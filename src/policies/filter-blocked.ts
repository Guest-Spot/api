export default async (policyContext) => {
  const { args } = policyContext;

  args.filters = {
    ...args.filters,
    or: [
      { blocked: { null: true } },
      { blocked: { eq: false } },
    ],
  };

  return true;
};
