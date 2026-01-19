import {
  getCurrentUserCoordinates,
  orderUserIdsByDistance,
  reorderUsers,
} from '../users-permissions/utils/user-distance';

type PaginationArgs = {
  page?: number;
  pageSize?: number;
  start?: number;
  limit?: number;
};

type DistanceSortDirection = 'asc' | 'desc';

type UsersQueryArgs = {
  filters?: unknown;
  sort?: unknown;
  start: number;
  limit: number;
};

const resolvePagination = (pagination?: PaginationArgs) => {
  if (!pagination) {
    return { page: 1, pageSize: 10, start: 0, limit: 10 };
  }

  const page =
    typeof pagination.page === 'number' && pagination.page > 0 ? pagination.page : undefined;
  const pageSize =
    typeof pagination.pageSize === 'number' && pagination.pageSize > 0
      ? pagination.pageSize
      : undefined;
  const start =
    typeof pagination.start === 'number' && pagination.start >= 0 ? pagination.start : undefined;
  const limit =
    typeof pagination.limit === 'number' && pagination.limit > 0 ? pagination.limit : undefined;

  if (page !== undefined || pageSize !== undefined) {
    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 10;
    return {
      page: resolvedPage,
      pageSize: resolvedPageSize,
      start: (resolvedPage - 1) * resolvedPageSize,
      limit: resolvedPageSize,
    };
  }

  const resolvedStart = start ?? 0;
  const resolvedLimit = limit ?? 10;
  return {
    page: Math.floor(resolvedStart / resolvedLimit) + 1,
    pageSize: resolvedLimit,
    start: resolvedStart,
    limit: resolvedLimit,
  };
};

const buildPaginationMeta = (page: number, pageSize: number, total: number) => {
  const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    page,
    pageSize,
    pageCount,
    total,
  };
};

const normalizeDistanceDirection = (value: unknown): DistanceSortDirection | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'asc' || normalized === 'desc' ? normalized : null;
};

const mapGraphQLFiltersToStrapi = (filters: unknown) => {
  const contentType = strapi.getModel('plugin::users-permissions.user');
  const graphqlUtils = strapi.plugin('graphql').service('utils');
  return graphqlUtils.mappers.graphQLFiltersToStrapiQuery(filters, contentType);
};

const buildQueryArgs = (args: any) => {
  const pagination = resolvePagination(args?.pagination);
  const filters = mapGraphQLFiltersToStrapi(args?.filters ?? {});
  const queryArgs: UsersQueryArgs = {
    filters,
    sort: args?.sort,
    start: pagination.start,
    limit: pagination.limit,
  };

  return { pagination, queryArgs };
};

const fetchUsers = async (args: any, distanceSort?: DistanceSortDirection | null) => {
  const { pagination, queryArgs } = buildQueryArgs(args);

  const [users, total] = await Promise.all([
    strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: queryArgs.filters,
      sort: queryArgs.sort,
      start: queryArgs.start,
      limit: queryArgs.limit,
    }),
    strapi.entityService.count('plugin::users-permissions.user', {
      filters: queryArgs.filters as any,
    }),
  ]);

  return {
    users: Array.isArray(users) ? users : [],
    pagination: buildPaginationMeta(pagination.page, pagination.pageSize, total),
    distanceSortDirection: distanceSort ?? null,
    queryArgs,
  };
};

const applyDistanceSort = async (
  ctx: any,
  users: any[],
  direction: DistanceSortDirection | null
) => {
  if (!users.length) {
    return users;
  }

  if (!direction) {
    return users;
  }

  const coords = await getCurrentUserCoordinates(ctx);
  if (!coords) {
    strapi.log?.debug?.('[GraphQL Distance Sort] No coordinates for current user, skipping sort');
    return users;
  }

  try {
    const userIds = users.map((user: { id: number }) => user.id);
    const orderedIds = await orderUserIdsByDistance(userIds, coords, direction);
    const orderedUsers = reorderUsers(users, orderedIds);
    
    strapi.log?.debug?.(
      `[GraphQL Distance Sort] Sorted ${users.length} users from coordinates (${coords.lat}, ${coords.lng})`
    );
    
    return orderedUsers;
  } catch (error) {
    strapi.log?.error?.('[GraphQL] Failed to order users by distance:', error);
    return users;
  }
};

export const usersPermissionsDistanceExtension = () => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      usersPermissionsUsers(
        filters: UsersPermissionsUserFiltersInput
        pagination: PaginationArg
        sort: [String]
        distanceSort: String
      ): [UsersPermissionsUser]
      
      usersPermissionsUsers_connection(
        filters: UsersPermissionsUserFiltersInput
        pagination: PaginationArg
        sort: [String]
        distanceSort: String
      ): UsersPermissionsUserEntityResponseCollection
    }
    
    extend type UsersPermissionsUserEntityResponseCollection {
      pagination: Pagination
    }
  `,
  resolvers: {
    Query: {
      usersPermissionsUsers: {
        resolve: async (parent: unknown, args: any, context: any) => {
          const hasOtherSort = !!(args?.sort && (Array.isArray(args.sort) ? args.sort.length > 0 : true));
          // Disable distanceSort if sort is present - sort takes priority
          const distanceSort = hasOtherSort ? null : normalizeDistanceDirection(args?.distanceSort);
          
          const { users, distanceSortDirection } = await fetchUsers(args, distanceSort);
          const orderedUsers = await applyDistanceSort(context, users, distanceSortDirection);

          // Strapi 5 GraphQL expects an array directly for this query
          return Array.isArray(orderedUsers) ? orderedUsers : [];
        },
      },
      usersPermissionsUsers_connection: {
        resolve: async (parent: unknown, args: any, context: any) => {
          const hasOtherSort = !!(args?.sort && (Array.isArray(args.sort) ? args.sort.length > 0 : true));
          // Disable distanceSort if sort is present - sort takes priority
          const distanceSort = hasOtherSort ? null : normalizeDistanceDirection(args?.distanceSort);
          
          const { users, pagination, distanceSortDirection, queryArgs } = await fetchUsers(args, distanceSort);
          const orderedUsers = await applyDistanceSort(context, users, distanceSortDirection);

          // Return nodes and info with original args (GraphQL format)
          // Keep info args in Strapi query format so pagination resolver can validate them
          return {
            nodes: Array.isArray(orderedUsers) ? orderedUsers : [],
            info: {
              args: queryArgs,
              resourceUID: 'plugin::users-permissions.user',
            },
            // Store pre-computed pagination - we'll try to use it via a custom approach
            _customPagination: pagination,
          };
        },
      },
    },
    UsersPermissionsUserEntityResponseCollection: {
      pagination: {
        resolve: (parent: any) => {
          // Use pre-computed pagination with filtered total if available
          if (parent._customPagination) {
            strapi.log?.debug?.(
              `[GraphQL Pagination] Using pre-computed pagination with total: ${parent._customPagination.total}`
            );
            return parent._customPagination;
          }
          // Fallback: return undefined to let Strapi use default behavior
          strapi.log?.debug?.('[GraphQL Pagination] No pre-computed pagination found, using default');
          return undefined;
        },
      },
    },
  },
  resolversConfig: {
    // Allow public access - distance sorting will only apply if user is authenticated with coordinates
    'Query.usersPermissionsUsers': { auth: false },
    'Query.usersPermissionsUsers_connection': { auth: false },
  },
});
