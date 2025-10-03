export default async (policyContext) => {
  const { args, request } = policyContext;

  // For GraphQL
  if (args) {
    const blockedFilter = {
      or: [
        { blocked: { null: true } },
        { blocked: { eq: false } },
      ],
    };
    args.filters = {
      and: [args?.filters, blockedFilter],
    };
  } else {
    // For REST API
    const blockedFilter = { $or: [{ blocked: { $ne: true } }, { blocked: { $null: true } }] };
    const q = request?.query ?? {};
    if (q.filters) {
      q.filters = { $and: [q.filters, blockedFilter] };
    } else {
      q.filters = blockedFilter;
    }
    request.query = q;
  }

  return true;
};
