import jwt from 'jsonwebtoken';

// Helper function to get users-permissions services
const getService = (name: string) => {
  return strapi.plugin('users-permissions').service(name);
};

// Helper function to load user with profile
const getUserWithProfile = async (userId: string) => {
  const entity = await strapi.entityService.findOne(
    'plugin::users-permissions.user',
    userId,
    {
      populate: {
        shop: true,
        artist: true,
      },
    }
  ) as any;

  if (!entity) return null;

  let profile = null;
  if (entity.type === 'shop' && entity.shop) {
    profile = entity.shop;
  } else if (entity.type === 'artist' && entity.artist) {
    profile = entity.artist;
  }

  return {
    ...entity,
    profile: profile || { name: null },
  };
};

// Helper function to sanitize user data
const sanitizeUser = async (user: any, ctx?: any) => {
  const userSchema = strapi.getModel('plugin::users-permissions.user');
  
  // If we have context, use auth from it, otherwise create minimal auth object
  const auth = ctx?.state?.auth || { strategy: { name: 'users-permissions' } };
  
  return strapi.contentAPI.sanitize.output(user, userSchema, { auth });
};

export default {
  register({ strapi }) {
    const extension = () => ({
      typeDefs: /* GraphQL */ `
        type Profile {
          name: String
        }

        extend type UsersPermissionsMe {
          uuid: String
          type: String
          profile: Profile!
        }

        type AuthPayload {
          jwt: String!
          refreshToken: String!
          user: UsersPermissionsMe!
        }

        input LoginInput {
          identifier: String!
          password: String!
        }

        input RefreshTokenInput {
          refreshToken: String!
        }

        extend type Mutation {
          loginWithRefresh(input: LoginInput!): AuthPayload
          refreshToken(input: RefreshTokenInput!): AuthPayload
          logoutWithRefresh(input: RefreshTokenInput!): Boolean
        }
      `,
      resolvers: {
        Query: {
          me: {
            resolve: async (parent: unknown, args: unknown, ctx: any) => {
              const authUser = ctx.state.user;
              if (!authUser) return null;

              const userWithProfile = await getUserWithProfile(authUser.id);
              if (!userWithProfile) return null;

              const schema = strapi.contentType('plugin::users-permissions.user');
              const sanitized = await strapi.contentAPI.sanitize.output(userWithProfile, schema, {
                auth: ctx.state.auth,
              });

              return sanitized;
            },
          },
        },
        Mutation: {
          loginWithRefresh: {
            resolve: async (parent: unknown, args: any, ctx: any) => {
              const { identifier, password } = args.input;

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
          },
          refreshToken: {
            resolve: async (parent: unknown, args: any, ctx: any) => {
              const { refreshToken } = args.input;

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
          },
          logoutWithRefresh: {
            resolve: async (parent: unknown, args: any, ctx: any) => {
              const { refreshToken } = args.input;

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
          },
        },
      },
      resolversConfig: {
        'Query.me': { auth: true },
        'Mutation.loginWithRefresh': { auth: false },
        'Mutation.refreshToken': { auth: false },
        'Mutation.logoutWithRefresh': { auth: false },
      },
    });

    strapi.plugin('graphql').service('extension').use(extension);
  },
};