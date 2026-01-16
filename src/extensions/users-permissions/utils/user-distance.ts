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
    return null;
  }

  const profile = await strapi.db.query('api::profile.profile').findOne({
    where: { user: userId },
    select: ['lat', 'lng'],
  });

  const lat = parseCoordinate(profile?.lat);
  const lng = parseCoordinate(profile?.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
};

export const orderUserIdsByDistance = async (userIds: number[], coords: Coordinates) => {
  if (!userIds.length) {
    return [];
  }

  const { lat, lng } = coords;

  const rows = await strapi.db
    .connection('up_users as users')
    .leftJoin('profiles as profiles', 'profiles.user_id', 'users.id')
    .whereIn('users.id', userIds)
    .orderByRaw(
      `
        (
          6371000 * acos(
            LEAST(1.0,
              cos(radians(?)) * cos(radians(profiles.lat)) *
              cos(radians(profiles.lng) - radians(?)) +
              sin(radians(?)) * sin(radians(profiles.lat))
            )
          )
        ) ASC NULLS LAST
      `,
      [lat, lng, lat]
    )
    .select('users.id');

  return rows.map((row: { id: number }) => row.id);
};

export const reorderUsers = <T extends { id: number }>(users: T[], orderedIds: number[]) => {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const ordered = orderedIds
    .map((id) => usersById.get(id))
    .filter((user): user is T => Boolean(user));

  if (ordered.length !== users.length) {
    const orderedSet = new Set(orderedIds);
    for (const user of users) {
      if (!orderedSet.has(user.id)) {
        ordered.push(user);
      }
    }
  }

  return ordered;
};
