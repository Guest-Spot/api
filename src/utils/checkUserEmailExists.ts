export const checkUserEmailExists = async (strapi: any, email: string): Promise<boolean> => {
  if (!strapi) {
    return false;
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail) {
    return false;
  }

  try {
    const users = await strapi
      .documents('plugin::users-permissions.user')
      .findMany({
        filters: {
          email: {
            $eq: normalizedEmail,
          },
        },
        limit: 1,
      });

    return users.length > 0;
  } catch (error) {
    strapi.log?.error?.('Failed to check user email existence', error);
    return false;
  }
};
