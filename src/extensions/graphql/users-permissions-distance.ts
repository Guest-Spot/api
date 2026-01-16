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
  const filters = args?.filters ?? {};
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
    return users;
  }

  try {
    const orderedIds = await orderUserIdsByDistance(
      users.map((user: { id: number }) => user.id),
      coords
    );
    return reorderUsers(users, orderedIds);
  } catch (error) {
    strapi.log?.error?.('[GraphQL] Failed to order users by distance:', error);
    return users;
  }
};

export const usersPermissionsDistanceExtension = () => ({
  typeDefs: /* GraphQL */ ``,
  resolvers: {
    Query: {
      async usersPermissionsUsers(parent: unknown, args: any, context: any) {
        const { users, pagination } = await fetchUsers(args);
        const orderedUsers = await applyDistanceSort(context, users);

        return {
          data: orderedUsers,
          meta: {
            pagination,
          },
        };
      },
      async usersPermissionsUsers_connection(parent: unknown, args: any, context: any) {
        const { users, pagination } = await fetchUsers(args);
        const orderedUsers = await applyDistanceSort(context, users);

        return {
          nodes: orderedUsers,
          pageInfo: pagination,
        };
      },
    },
  },
  resolversConfig: {
    'Query.usersPermissionsUsers': { auth: true },
    'Query.usersPermissionsUsers_connection': { auth: true },
  },
});
