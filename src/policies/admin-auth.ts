/**
 * Allow admin panel widgets to call a content-type route by validating the admin session token.
 * We mimic the built-in admin auth strategy so that `ctx.state.user` and `ctx.state.auth.strategy.name`
 * are populated for existing helpers like `isAdmin`.
 */

const BEARER_REGEX = /^Bearer\s+(.+)$/i;

const getAdminSessionManager = ({ strapi }) => {
  const sessionManager = strapi.sessionManager;
  if (!sessionManager) {
    return null;
  }
  return sessionManager('admin');
};

export default async (policyContext, config, { strapi }) => {
  const ctx = policyContext;
  const authorization = ctx.request.header.authorization;

  if (!authorization) {
    ctx.unauthorized('Admin token is required');
    return false;
  }

  const matches = authorization.match(BEARER_REGEX);
  if (!matches) {
    ctx.unauthorized('Malformed Authorization header');
    return false;
  }

  const token = matches[1];
  const manager = getAdminSessionManager({ strapi });

  if (!manager) {
    strapi.log.error('Admin session manager is not available');
    ctx.unauthorized('Admin session manager unavailable');
    return false;
  }

  const validation = manager.validateAccessToken(token);
  if (!validation.isValid) {
    ctx.unauthorized('Invalid admin token');
    return false;
  }

  const isActive = await manager.isSessionActive(validation.payload.sessionId);
  if (!isActive) {
    ctx.unauthorized('Admin session is no longer active');
    return false;
  }

  const rawUserId = validation.payload.userId;
  const numericUserId = Number(rawUserId);
  const userId =
    Number.isFinite(numericUserId) && String(numericUserId) === rawUserId ? numericUserId : rawUserId;

  const adminUser = await strapi.db.query('admin::user').findOne({
    where: { id: userId },
    populate: ['roles'],
  });

  if (!adminUser || adminUser.isActive !== true) {
    ctx.unauthorized('Admin user is not active');
    return false;
  }

  ctx.state.user = adminUser;
  ctx.state.auth = {
    strategy: { name: 'admin' },
    credentials: adminUser,
  };
  ctx.state.isAuthenticated = true;
  return true;
};
