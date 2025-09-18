export default () => {
  const ctx = strapi.requestContext.get();

  if (!ctx) {
    // Request is not from admin panel
    return false;
  }

  const strategy = ctx?.state?.auth?.strategy?.name;
  const user = ctx?.state?.user;

  if (!user) return false;

  // --- Admin panel (RBAC) ---
  if (strategy === 'admin') {
    // roles can be: 'strapi-super-admin', 'strapi-editor', 'strapi-author'
    return user.roles?.some(r =>
      ['strapi-super-admin', 'strapi-editor', 'strapi-author'].includes(r.code)
    );
  }

  // --- API users (Users & Permissions) ---
  if (strategy === 'users-permissions') {
    // if you have an "admin" role in the API
    return user.role?.code === 'admin';
  }

  // --- API Tokens ---
  if (strategy === 'api-token') {
    // token can be full-access or with limited permissions
    return user?.type === 'full-access';
  }

  return false;
};
