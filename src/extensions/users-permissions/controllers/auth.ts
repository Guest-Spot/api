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

interface AuthInput {
  identifier: string;
  password: string;
}

interface RefreshTokenInput {
  refreshToken: string;
}

export default {
  async callback(ctx) {
    const provider = ctx.params.provider || 'local';
    const params = ctx.request.body;

    const store = strapi.store({
      environment: strapi.config.environment,
      type: 'plugin',
      name: 'users-permissions',
    });

    if (provider === 'local') {
      const { identifier, password }: AuthInput = params;

      if (!identifier || !password) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Missing identifier or password')
        );
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

      if (!user) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Invalid identifier or password')
        );
      }

      if (!user.password) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Invalid identifier or password')
        );
      }

      const validPassword = await getService('user').validatePassword(
        password,
        user.password
      );

      if (!validPassword) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Invalid identifier or password')
        );
      }

      if (user.confirmed !== true) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Your account email is not confirmed')
        );
      }

      if (user.blocked === true) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Your account has been blocked by an administrator')
        );
      }

      // Create JWT token (short-lived)
      const jwt = getService('jwt').issue({ id: user.id });

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

      ctx.send({
        jwt,
        refreshToken,
        user: await sanitizeUser(user, ctx),
      });
    } else {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Provider not supported')
        );
    }
  },

  async refreshToken(ctx) {
    const { refreshToken }: RefreshTokenInput = ctx.request.body;

    if (!refreshToken) {
      return ctx.badRequest(
        null,
        new errors.ApplicationError('Missing refresh token')
      );
    }

    try {
      const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'default-secret';
      
      // Verify refresh token
      const decoded: any = jwt.verify(refreshToken, refreshTokenSecret as string);

      if (decoded.type !== 'refresh') {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Invalid token type')
        );
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
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Invalid refresh token')
        );
      }

      if (user.blocked === true) {
        return ctx.badRequest(
          null,
          new errors.ApplicationError('Your account has been blocked by an administrator')
        );
      }

      // Create new JWT token
      const newJwt = getService('jwt').issue({ id: user.id });

      // Optionally create new refresh token (for token rotation)
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

      ctx.send({
        jwt: newJwt,
        refreshToken: newRefreshToken,
        user: await sanitizeUser(user, ctx),
      });
    } catch (error) {
      return ctx.badRequest(
        null,
        new errors.ApplicationError('Invalid or expired refresh token')
      );
    }
  },

  async logout(ctx) {
    const { refreshToken }: RefreshTokenInput = ctx.request.body;

    if (!refreshToken) {
      return ctx.badRequest(
        null,
        new errors.ApplicationError('Missing refresh token')
      );
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

      ctx.send({
        message: 'Logged out successfully',
      });
    } catch (error) {
      // Even if token is invalid, we consider logout successful
      ctx.send({
        message: 'Logged out successfully',
      });
    }
  },
};
