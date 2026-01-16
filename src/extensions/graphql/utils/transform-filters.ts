/**
 * Transform GraphQL filters to Entity Service format
 *
 * GraphQL uses: { field: { eq: "value" }, or: [...] }
 * Entity Service uses: { field: { $eq: "value" }, $or: [...] }
 */

// GraphQL operators to Entity Service operators mapping
const OPERATOR_MAP: Record<string, string> = {
  eq: '$eq',
  eqi: '$eqi',
  ne: '$ne',
  nei: '$nei',
  lt: '$lt',
  lte: '$lte',
  gt: '$gt',
  gte: '$gte',
  in: '$in',
  notIn: '$notIn',
  contains: '$contains',
  containsi: '$containsi',
  notContains: '$notContains',
  notContainsi: '$notContainsi',
  startsWith: '$startsWith',
  startsWithi: '$startsWithi',
  endsWith: '$endsWith',
  endsWithi: '$endsWithi',
  null: '$null',
  notNull: '$notNull',
  between: '$between',
};

const LOGICAL_OPERATORS = ['and', 'or', 'not'];

/**
 * Recursively transforms GraphQL filter format to Entity Service format
 * @param filters - GraphQL filters object
 * @returns Transformed filters for Entity Service
 */
export const transformFilters = (filters: any): any => {
  if (!filters || typeof filters !== 'object') {
    return filters;
  }

  if (Array.isArray(filters)) {
    return filters.map(transformFilters);
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(filters)) {
    // Handle logical operators (and, or, not)
    if (LOGICAL_OPERATORS.includes(key)) {
      result[`$${key}`] = transformFilters(value);
      continue;
    }

    // Check if the key is a GraphQL operator
    if (OPERATOR_MAP[key]) {
      result[OPERATOR_MAP[key]] = value;
      continue;
    }

    // Recursively transform nested objects
    if (value && typeof value === 'object') {
      result[key] = transformFilters(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};
