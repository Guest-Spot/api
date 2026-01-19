type Coordinates = {
  lat: number;
  lng: number;
};

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const getCurrentUserCoordinates = async (ctx: any): Promise<Coordinates | null> => {
  const authUser = ctx?.state?.user;
  const userId = authUser?.id;

  if (!userId) {
    strapi.log?.debug?.('[Distance Sort] No user ID in context');
    return null;
  }

  const profile = await strapi.db.query('api::profile.profile').findOne({
    where: { user: { id: userId } },
    select: ['lat', 'lng'],
  });

  if (!profile) {
    strapi.log?.debug?.(`[Distance Sort] No profile found for user ${userId}`);
    return null;
  }

  const lat = parseCoordinate(profile?.lat);
  const lng = parseCoordinate(profile?.lng);

  if (lat === null || lng === null) {
    strapi.log?.debug?.(
      `[Distance Sort] Profile found for user ${userId}, but coordinates are missing (lat: ${profile?.lat}, lng: ${profile?.lng})`
    );
    return null;
  }

  return { lat, lng };
};

export const orderUserIdsByDistance = async (
  userIds: number[],
  coords: Coordinates,
  direction: 'asc' | 'desc' = 'asc'
) => {
  if (!userIds.length) {
    return [];
  }

  const { lat, lng } = coords;
  const orderDirection = direction === 'desc' ? 'DESC' : 'ASC';
  const nullsPlacement = direction === 'desc' ? 'NULLS FIRST' : 'NULLS LAST';

  // Strapi 5 uses a separate join table for oneToOne relations
  // profiles_user_lnk: { id, profile_id, user_id }
  // Note: LEFT JOIN may return duplicates if link table has multiple entries,
  // but reorderUsers handles deduplication in JavaScript
  // Use CASE WHEN to handle NULL coordinates - users without coordinates get NULL distance
  // Cannot use DISTINCT with ORDER BY expression in PostgreSQL, so deduplication is done in JS
  const rows = await strapi.db
    .connection('up_users as users')
    .leftJoin('profiles_user_lnk as lnk', 'lnk.user_id', 'users.id')
    .leftJoin('profiles as profiles', 'profiles.id', 'lnk.profile_id')
    .whereIn('users.id', userIds)
    .orderByRaw(
      `
        CASE 
          WHEN profiles.lat IS NULL OR profiles.lng IS NULL THEN NULL
          ELSE (
            6371000 * acos(
              LEAST(1.0,
                cos(radians(?)) * cos(radians(profiles.lat)) *
                cos(radians(profiles.lng) - radians(?)) +
                sin(radians(?)) * sin(radians(profiles.lat))
              )
            )
          )
        END ${orderDirection} ${nullsPlacement}
      `,
      [lat, lng, lat]
    )
    .select('users.id');

  // Deduplicate IDs while preserving order (first occurrence wins)
  const seenIds = new Set<number>();
  const orderedIds: number[] = [];
  for (const row of rows) {
    const id = row.id;
    if (!seenIds.has(id)) {
      orderedIds.push(id);
      seenIds.add(id);
    }
  }
  
  // Log for debugging - check if all users are included
  if (orderedIds.length !== userIds.length) {
    strapi.log?.warn?.(
      `[Distance Sort] Expected ${userIds.length} users, got ${orderedIds.length} from SQL query`
    );
  }

  return orderedIds;
};

export const reorderUsers = <T extends { id: number }>(users: T[], orderedIds: number[]) => {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const seen = new Set<number>();
  const ordered: T[] = [];

  // Add users in order, skipping duplicates
  for (const id of orderedIds) {
    if (seen.has(id)) {
      continue;
    }
    const user = usersById.get(id);
    if (user) {
      ordered.push(user);
      seen.add(id);
    }
  }

  // Add any users that weren't in orderedIds
  for (const user of users) {
    if (!seen.has(user.id)) {
      ordered.push(user);
      seen.add(user.id);
    }
  }

  return ordered;
};
