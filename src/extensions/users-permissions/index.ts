import { authLogic } from './controllers/auth';

export const usersPermissionsExtension = () => ({
  typeDefs: /* GraphQL */ `
    extend type UploadFile {
      id: ID
    }

    extend type UsersPermissionsMe {
      type: String
      name: String
      email: String
      avatar: UploadFile
      pictures: [UploadFile]
      description: String
      country: String
      state: String
      city: String
      address: String
      link: String
      phone: String
      experience: Int
      openingHours: [ComponentTimeOpeningHour]
      parent: UsersPermissionsMe
      childs: [UsersPermissionsMe]
      device_tokens: [DeviceToken]
      depositAmount: Float
      chargeDeposit: Boolean
      profile: Profile
      acceptTips: Boolean
      guestSpotEnabled: Boolean
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
      platform: String
    }

    extend input UsersPermissionsRegisterInput {
      name: String
      phone: String
      type: String
      description: String
      city: String
      address: String
      link: String
      experience: String
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

          const schema = strapi.contentType('plugin::users-permissions.user');
          const userWithRelations = await strapi.entityService.findOne(
            'plugin::users-permissions.user',
            authUser.id,
            {
              populate: [
                'avatar',
                'pictures',
                'profile',
                'openingHours',
                'parent',
                'childs',
                'device_tokens'],
            }
          );

          if (!userWithRelations) return null;

          const sanitized = await strapi.contentAPI.sanitize.output(
            userWithRelations,
            schema,
            {
              auth: ctx.state.auth,
            }
          );

          return sanitized;
        },
      },
    },
    Mutation: {
      loginWithRefresh: {
        resolve: async (parent: unknown, args: any, ctx: any) => {
          const { identifier, password } = args.input;
          return authLogic.loginWithRefresh(identifier, password, ctx);
        },
      },
      refreshToken: {
        resolve: async (parent: unknown, args: any, ctx: any) => {
          const { refreshToken } = args.input;
          return authLogic.refreshToken(refreshToken, ctx);
        },
      },
      logoutWithRefresh: {
        resolve: async (parent: unknown, args: any, ctx: any) => {
          const { refreshToken, platform } = args.input;
          return authLogic.logoutWithRefresh(refreshToken, platform);
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
