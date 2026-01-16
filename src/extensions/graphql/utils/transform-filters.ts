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

// Keys that are already in Entity Service format (start with $)
const isEntityServiceOperator = (key: string): boolean => key.startsWith('$');

// Check if value is a plain object (not Date, Array, null, etc.)
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  // Check for Date, RegExp, and other special objects
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
};

/**
 * Recursively transforms GraphQL filter format to Entity Service format
 * @param filters - GraphQL filters object
 * @returns Transformed filters for Entity Service
 */
export const transformFilters = (filters: unknown): unknown => {
  // Handle null, undefined, primitives
  if (filters === null || filters === undefined) {
    return filters;
  }

  if (typeof filters !== 'object') {
    return filters;
  }

  // Handle arrays - recursively transform each element
  if (Array.isArray(filters)) {
    return filters.map(transformFilters);
  }

  // Skip transformation for non-plain objects (Date, etc.)
  if (!isPlainObject(filters)) {
    return filters;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    // Skip keys that are already in Entity Service format
    if (isEntityServiceOperator(key)) {
      // Still need to recursively transform the value for nested structures
      result[key] = transformFilters(value);
      continue;
    }

    // Handle logical operators (and, or, not)
    if (LOGICAL_OPERATORS.includes(key)) {
      result[`$${key}`] = transformFilters(value);
      continue;
    }

    // Check if the key is a GraphQL operator
    if (OPERATOR_MAP[key]) {
      // Transform operator key and recursively transform value
      // (value might be an array that needs transformation)
      result[OPERATOR_MAP[key]] = transformFilters(value);
      continue;
    }

    // Recursively transform nested objects/arrays
    result[key] = transformFilters(value);
  }

  return result;
};
