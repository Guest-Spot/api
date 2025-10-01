import jwt from 'jsonwebtoken';
import _ from 'lodash';
import { errors } from '@strapi/utils';

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

  async logoutWithRefresh(refreshToken: string) {
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    try {
      const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
      const decoded: any = jwt.verify(refreshToken, refreshTokenSecret as string);

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
    const user = await getService('providers').connect(provider, ctx.query);

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
};

export default {
  async callback(ctx) {
    const provider = ctx.query.provider;

    if (provider === 'google') {
      try {
        const result = await authLogic.loginWithOAuth(provider, ctx);
        ctx.send(result);
      } catch (error) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError(error.message)
        );
      }
    } else {
      return ctx.badRequest(
        null,
        new errors.ApplicationError('Provider not supported')
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
    const { refreshToken }: RefreshTokenInput = ctx.request.body;

    try {
      const result = await authLogic.logoutWithRefresh(refreshToken);
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
};
