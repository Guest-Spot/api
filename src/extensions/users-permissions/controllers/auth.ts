import jwt from 'jsonwebtoken';
import _ from 'lodash';
import { errors } from '@strapi/utils';
import grantFactory from 'grant';
import { checkUserEmailExists } from '../../../utils/checkUserEmailExists';
import { ensureAppleUser, type AppleNativeAuthInput } from '../services/apple-native-auth';

// Helper function to get users-permissions services
const getService = (name: string) => {
  return strapi.plugin('users-permissions').service(name);
};

// Helper function to sanitize user data
const sanitizeUser = async (user: any, ctx?: any) => {
  const userSchema = strapi.getModel('plugin::users-permissions.user');
  
  // If we have context, use auth from it, otherwise create minimal auth object
  const auth = ctx?.state?.auth || { strategy: { name: 'users-permissions' } };
  
  return strapi.contentAPI.sanitize.output(user, userSchema, { auth });
};

interface RefreshTokenInput {
  refreshToken: string;
}

interface LogoutInput extends RefreshTokenInput {
  platform?: string;
}

const resolveUserId = (userId: unknown): number | null => {
  if (typeof userId === 'number' && Number.isFinite(userId)) {
    return userId;
  }

  if (typeof userId === 'string') {
    const trimmed = userId.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const clearDeviceTokensForPlatform = async (userId: unknown, platform?: string | null) => {
  if (!platform || typeof platform !== 'string') {
    return;
  }

  const trimmedPlatform = platform.trim();

  if (!trimmedPlatform) {
    return;
  }

  const normalizedUserId = resolveUserId(userId);

  if (normalizedUserId === null) {
    return;
  }

  try {
    await strapi.db.query('api::device-token.device-token').deleteMany({
      where: {
        user: { id: normalizedUserId },
        platform: trimmedPlatform,
      },
    });
  } catch (error) {
    strapi.log?.error?.(
      `[Auth] Failed to clear device tokens for user ${normalizedUserId} on platform ${trimmedPlatform}:`,
      error
    );
  }
};

// Auth logic functions for reuse in GraphQL resolvers
export const authLogic = {
  sanitizeUser,

  async loginWithRefresh(identifier: string, password: string, ctx?: any) {
    if (!identifier || !password) {
      throw new Error('Missing identifier or password');
    }

    const query = strapi.db.query('plugin::users-permissions.user');
    const user = await query.findOne({
      where: {
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
    });

    if (!user || !user.password) {
      throw new Error('Invalid identifier or password');
    }

    const validPassword = await getService('user').validatePassword(
      password,
      user.password
    );

    if (!validPassword) {
      throw new Error('Invalid identifier or password');
    }

    if (user.confirmed !== true) {
      throw new Error('Your account email is not confirmed');
    }

    if (user.blocked === true) {
      throw new Error('Your account has been blocked by an administrator');
    }

    // Create JWT token (short-lived)
    const jwtToken = getService('jwt').issue({ id: user.id });

    // Create refresh token (long-lived)
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      refreshTokenSecret as string,
      { expiresIn: '30d' }
    );

    // Save refresh token to user
    await strapi.entityService.update('plugin::users-permissions.user', user.id, {
      data: {
        refreshToken,
      } as any,
    });

    const sanitizedUser = await sanitizeUser(user, ctx);

    return {
      jwt: jwtToken,
      refreshToken,
      user: sanitizedUser,
    };
  },

  async refreshToken(refreshToken: string, ctx?: any) {
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    try {
      const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
      
      // Verify refresh token
      const decoded: any = jwt.verify(refreshToken, refreshTokenSecret as string);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Find user with this refresh token
      const query = strapi.db.query('plugin::users-permissions.user');
      const user = await query.findOne({
        where: {
          id: decoded.id,
          refreshToken,
        },
      });

      if (!user) {
        throw new Error('Invalid refresh token');
      }

      if (user.blocked === true) {
        throw new Error('Your account has been blocked by an administrator');
      }

      // Create new JWT token
      const newJwt = getService('jwt').issue({ id: user.id });

      // Create new refresh token (for token rotation)
      const newRefreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        refreshTokenSecret as string,
        { expiresIn: '30d' }
      );

      // Update user with new refresh token
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          refreshToken: newRefreshToken,
        } as any,
      });

      const sanitizedUser = await sanitizeUser(user, ctx);

      return {
        jwt: newJwt,
        refreshToken: newRefreshToken,
        user: sanitizedUser,
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  },

  async logoutWithRefresh(refreshToken: string, platform?: string) {
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    try {
      const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
      const decoded: any = jwt.verify(refreshToken, refreshTokenSecret as string);

      await clearDeviceTokensForPlatform(decoded?.id, platform);

      // Clear refresh token from user
      const query = strapi.db.query('plugin::users-permissions.user');
      const user = await query.findOne({
        where: {
          id: decoded.id,
          refreshToken,
        },
      });

      if (user) {
        await strapi.entityService.update('plugin::users-permissions.user', user.id, {
          data: {
            refreshToken: null,
          } as any,
        });
      }

      return true;
    } catch (error) {
      // Even if token is invalid, we consider logout successful
      return true;
    }
  },

  async loginWithOAuth(provider: string, ctx: any) {
    const queryParams: Record<string, unknown> =
      ctx?.query && typeof ctx.query === 'object' ? ctx.query : {};
    const bodyParams: Record<string, unknown> =
      ctx?.request?.body && typeof ctx.request.body === 'object'
        ? ctx.request.body
        : {};

    const oauthPayload: Record<string, unknown> = {
      ...queryParams,
      ...bodyParams,
    };

    const extractString = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const candidate = extractString(item);
          if (candidate) {
            return candidate;
          }
        }
      }

      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;

        if ('code' in record) {
          const nestedCode = extractString(record.code);
          if (nestedCode) {
            return nestedCode;
          }
        }

        if ('value' in record) {
          return extractString(record.value);
        }
      }

      return undefined;
    };

    const pickFirst = (...candidates: unknown[]) => {
      for (const candidate of candidates) {
        const extracted = extractString(candidate);
        if (extracted) {
          return extracted;
        }
      }
      return undefined;
    };

    if (!extractString(oauthPayload.code)) {
      const codeCandidate = pickFirst(
        bodyParams.code,
        bodyParams.authorizationCode,
        (bodyParams as Record<string, unknown>).authorization_code,
        (bodyParams as Record<string, unknown>).authorization,
        (bodyParams as Record<string, unknown>).user,
        (bodyParams as Record<string, unknown>).data,
        queryParams.code,
        queryParams.authorizationCode,
        (queryParams as Record<string, unknown>).authorization_code,
        (queryParams as Record<string, unknown>).authorization,
        (queryParams as Record<string, unknown>).user,
        (queryParams as Record<string, unknown>).data
      );

      if (codeCandidate) {
        oauthPayload.code = codeCandidate;
      }
    }

    if (!extractString(oauthPayload.access_token)) {
      const tokenCandidate = pickFirst(
        oauthPayload.code,
        bodyParams.access_token,
        (bodyParams as Record<string, unknown>).user,
        (bodyParams as Record<string, unknown>).token,
        bodyParams.id_token,
        bodyParams.identity_token,
        queryParams.access_token,
        (queryParams as Record<string, unknown>).user,
        (queryParams as Record<string, unknown>).token,
        queryParams.id_token,
        queryParams.identity_token
      );

      if (tokenCandidate) {
        oauthPayload.access_token = tokenCandidate;
      }
    }

    if (!extractString(oauthPayload.identityToken)) {
      const identityTokenCandidate = pickFirst(
        oauthPayload.access_token,
        bodyParams.identityToken,
        bodyParams.identity_token,
        bodyParams.id_token,
        queryParams.identityToken,
        (queryParams as Record<string, unknown>).identity_token,
        queryParams.id_token
      );

      if (identityTokenCandidate) {
        oauthPayload.identityToken = identityTokenCandidate;
      }
    }

    if (provider === 'apple') {
      const identityToken = extractString(oauthPayload.identityToken);

      if (!identityToken) {
        throw new Error('Missing Apple identity token');
      }

      return authLogic.loginWithAppleNative(
        {
          identityToken,
        },
        ctx
      );
    }

    const user = await getService('providers').connect(provider, oauthPayload);

    if (user.confirmed !== true) {
      throw new Error('Your account email is not confirmed');
    }

    if (user.blocked === true) {
      throw new Error('Your account has been blocked by an administrator');
    }

    // Create JWT token (short-lived)
    const jwtToken = getService('jwt').issue({ id: user.id });

    // Create refresh token (long-lived)
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      refreshTokenSecret as string,
      { expiresIn: '30d' }
    );

    // Save refresh token to user
    await strapi.entityService.update('plugin::users-permissions.user', user.id, {
      data: {
        refreshToken,
      } as any,
    });

    const sanitizedUser = await sanitizeUser(user, ctx);

    return {
      jwt: jwtToken,
      refreshToken,
      user: sanitizedUser,
    };
  },

  async loginWithAppleNative(input: AppleNativeAuthInput, ctx?: any) {
    const { user } = await ensureAppleUser(strapi, input);

    if (user.blocked === true) {
      throw new Error('Your account has been blocked by an administrator');
    }

    const jwtToken = getService('jwt').issue({ id: user.id });

    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      refreshTokenSecret as string,
      { expiresIn: '30d' }
    );

    await strapi.entityService.update('plugin::users-permissions.user', user.id, {
      data: {
        refreshToken,
      } as any,
    });

    const sanitizedUser = await sanitizeUser(user, ctx);

    return {
      jwt: jwtToken,
      refreshToken,
      user: sanitizedUser,
    };
  },
};

const customAuthController = (..._args: any[]) => ({
  async callback(ctx) {
    const providerFromParams = ctx.params?.provider;
    const providerFromQuery = ctx.query?.provider as string | undefined;
    const provider = (providerFromParams ?? providerFromQuery ?? '').toString();

    const supportedProviders = new Set(['google', 'apple']);

    if (provider && provider !== 'local') {
      if (!supportedProviders.has(provider)) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Provider not supported')
        );
      }

      try {
        const result = await authLogic.loginWithOAuth(provider, ctx);

        ctx.send(result);
        return;
      } catch (error: any) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError(error?.message ?? 'Authentication failed')
        );
      }
    }

    const { identifier, password } = ctx.request.body ?? {};
    const identifierValue = typeof identifier === 'string' ? identifier : '';
    const passwordValue = typeof password === 'string' ? password : '';

    if (!identifierValue || !passwordValue) {
      return ctx.badRequest(
        null,
        new errors.ValidationError('Missing identifier or password')
      );
    }

    try {
      const result = await authLogic.loginWithRefresh(identifierValue, passwordValue, ctx);
      ctx.send(result);
    } catch (error: any) {
      return ctx.badRequest(
        null,
        new errors.ApplicationError(error?.message ?? 'Authentication failed')
      );
    }
  },

  async refreshToken(ctx) {
    const { refreshToken }: RefreshTokenInput = ctx.request.body;

    try {
      const result = await authLogic.refreshToken(refreshToken, ctx);
      ctx.send(result);
    } catch (error) {
      return ctx.badRequest(
        null,
        new errors.ApplicationError(error.message)
      );
    }
  },

  async logout(ctx) {
    const { refreshToken, platform }: LogoutInput = ctx.request.body;
    try {
      const result = await authLogic.logoutWithRefresh(refreshToken, platform);
      ctx.send({
        message: 'Logged out successfully',
        success: result,
      });
    } catch (error) {
      // Even if token is invalid, we consider logout successful
      ctx.send({
        message: 'Logged out successfully',
        success: true,
      });
    }
  },

  async emailExists(ctx) {
    if (!ctx.query.email) {
      return ctx.badRequest(
        null,
        new errors.ValidationError('Missing email')
      );
    }

    try {
      const exists = await checkUserEmailExists(strapi, ctx.query.email);
      ctx.send({ exists });
    } catch (error) {
      strapi.log?.error?.('Failed to check email existence via REST', error);
      ctx.send({ exists: false });
    }
  },

  async connect(ctx, next) {
    const grant = grantFactory.koa();

    const providers = (await strapi
      .store({ type: 'plugin', name: 'users-permissions', key: 'grant' })
      .get()) as Record<string, any>;

    const apiPrefix =
      (strapi.config.get('api.rest.prefix') as string | undefined) ?? '/api';

    const grantConfig: Record<string, any> = {
      defaults: {
        prefix: `${apiPrefix}/connect`,
      },
      ...providers,
    };

    const requestUrl = typeof ctx.request.url === 'string' ? ctx.request.url : '';
    const [requestPath] = requestUrl.split('?');
    const providerSegment = requestPath.split('/connect/')[1];
    const providerName = providerSegment?.split('/')[0];

    if (!providerName) {
      throw new errors.ApplicationError('Provider not specified');
    }

    if (!_.get(grantConfig[providerName], 'enabled')) {
      throw new errors.ApplicationError('This provider is disabled');
    }

    const serverUrl = (strapi.config.get('server.url') as string | undefined) ?? '';

    if (!serverUrl.startsWith('http')) {
      strapi.log.warn(
        'You are using a third party provider for login. Make sure to set an absolute url in config/server.js. More info here: https://docs.strapi.io/developer-docs/latest/plugins/users-permissions.html#setting-up-the-server-url'
      );
    }

    const queryCustomCallback = _.get(ctx, 'query.callback');
    const dynamicSessionCallback = _.get(ctx, 'session.grant.dynamic.callback');
    const customCallback = queryCustomCallback ?? dynamicSessionCallback;

    if (!grantConfig[providerName]) {
      grantConfig[providerName] = {};
    }

    if (customCallback !== undefined) {
      try {
        const callbackConfig = strapi
          .plugin('users-permissions')
          .config('callback') as { validate: (callback: string, config: Record<string, unknown>) => Promise<void> };

        await callbackConfig.validate(customCallback as string, grantConfig[providerName]);
        grantConfig[providerName].callback = customCallback;
      } catch (error) {
        throw new errors.ValidationError('Invalid callback URL provided', {
          callback: customCallback,
        });
      }
    }

    grantConfig[providerName] = {
      ...grantConfig[providerName],
      redirect_uri: getService('providers').buildRedirectUri(providerName),
    };

    return grant(grantConfig)(ctx, next);
  },
});

export default customAuthController;
