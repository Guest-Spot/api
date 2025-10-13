export default async (userId: string) => {
  const entity = await strapi.entityService.findOne(
    'plugin::users-permissions.user',
    userId
  ) as any;

  if (!entity) return null;

  return entity
};
