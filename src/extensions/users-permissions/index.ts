import { authLogic } from './controllers/auth';
import getUserWithProfile from '../../utils/getUserWithProfile';

export const usersPermissionsExtension = () => ({
  typeDefs: /* GraphQL */ `
    extend type UploadFile {
      id: ID
    }

    extend type UsersPermissionsMe {
      type: String
      name: String
      avatar: UploadFile
      pictures: [UploadFile]
      description: String
      city: String
      address: String
      link: String
      phone: String
      experience: Int
      openingHours: [ComponentTimeOpeningHour]
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
          const { refreshToken } = args.input;
          return authLogic.logoutWithRefresh(refreshToken);
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