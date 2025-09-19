interface OwnershipFilterConfig {
  ownerField?: string;
  userRelation?: string;
}

type Filter = Record<string, unknown> & { $and?: unknown };

const isEmptyObject = (value: unknown) => {
  return (
    !value ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length === 0)
  );
};

const mergeFilters = (
  existingFilters: Filter | undefined,
  ownerFilter: Filter
): Filter => {
  if (!existingFilters || isEmptyObject(existingFilters)) {
    return ownerFilter;
  }

  const existingAnd = existingFilters.$and as unknown;

  if (Array.isArray(existingAnd)) {
    return {
      ...existingFilters,
      $and: [...existingAnd, ownerFilter],
    };
  }

  return {
    $and: [existingFilters, ownerFilter],
  };
};

export default (policyContext, config: OwnershipFilterConfig) => {
  const { user } = policyContext.state;

  if (!user) {
    return false;
  }

  const ownerFilter = (() => {
    if (config?.ownerField) {
      const ownerIdentifier = user.documentId ?? user.id;

      return {
        [config.ownerField]: { eq: ownerIdentifier },
      } as Filter;
    }

    if (config?.userRelation) {
      return {
        [config.userRelation]: {
          id: { eq: user.id },
        },
      } as Filter;
    }

    return null;
  })();

  if (!ownerFilter) {
    return false;
  }
  

  if (!policyContext.query) {
    policyContext.query = {};
  }

  policyContext.query = {
    ...policyContext.query,
    filters: mergeFilters(policyContext.query.filters, ownerFilter),
  };

  if (policyContext.args) {
    policyContext.args = {
      ...policyContext.args,
      filters: mergeFilters(policyContext.args.filters, ownerFilter),
    };
  }

  return true;
};
