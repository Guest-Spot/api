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
      city: String
      address: String
      link: String
      phone: String
      experience: Int
      openingHours: [ComponentTimeOpeningHour]
      parent: UsersPermissionsMe
      childs: [UsersPermissionsMe]
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

    extend input UsersPermissionsRegisterInput {
      name: String
      phone: String
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
              populate: ['avatar', 'pictures', 'openingHours', 'parent', 'childs'],
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
