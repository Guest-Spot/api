import {
  getCurrentUserCoordinates,
  orderUserIdsByDistance,
  reorderUsers,
} from '../users-permissions/utils/user-distance';
import { transformFilters } from './utils/transform-filters';

type PaginationArgs = {
  page?: number;
  pageSize?: number;
  start?: number;
  limit?: number;
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

const fetchUsers = async (args: any) => {
  const pagination = resolvePagination(args?.pagination);
  const rawFilters = args?.filters ?? {};
  const filters = transformFilters(rawFilters);
  const sort = args?.sort ?? undefined;

  const [users, total] = await Promise.all([
    strapi.entityService.findMany('plugin::users-permissions.user', {
      filters,
      sort,
      start: pagination.start,
      limit: pagination.limit,
    }),
    strapi.entityService.count('plugin::users-permissions.user', { filters }),
  ]);

  return {
    users: Array.isArray(users) ? users : [],
    pagination: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
};

const applyDistanceSort = async (ctx: any, users: any[]) => {
  if (!users.length) {
    return users;
  }

  const coords = await getCurrentUserCoordinates(ctx);
  if (!coords) {
    strapi.log?.debug?.('[GraphQL Distance Sort] No coordinates for current user, skipping sort');
    return users;
  }

  try {
    const userIds = users.map((user: { id: number }) => user.id);
    const orderedIds = await orderUserIdsByDistance(userIds, coords);
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
  typeDefs: /* GraphQL */ ``,
  resolvers: {
    Query: {
      usersPermissionsUsers: {
        resolve: async (parent: unknown, args: any, context: any) => {
          const { users } = await fetchUsers(args);
          const orderedUsers = await applyDistanceSort(context, users);

          // Strapi 5 GraphQL expects an array directly for this query
          return Array.isArray(orderedUsers) ? orderedUsers : [];
        },
      },
      usersPermissionsUsers_connection: {
        resolve: async (parent: unknown, args: any, context: any) => {
          const { users } = await fetchUsers(args);
          const orderedUsers = await applyDistanceSort(context, users);

          // Strapi 5 GraphQL pagination resolver expects this format
          // The `info` object is used by resolvePagination to calculate pagination metadata
          return {
            nodes: Array.isArray(orderedUsers) ? orderedUsers : [],
            info: {
              args: args ?? {},
              resourceUID: 'plugin::users-permissions.user',
            },
          };
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
