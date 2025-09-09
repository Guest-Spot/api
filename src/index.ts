import { randomUUID } from "node:crypto";

export default {
  register({ strapi }) {
    const extension = () => ({
      typeDefs: /* GraphQL */ `
        extend type UsersPermissionsMe {
          uuid: String
          type: String
        }
      `,
      resolvers: {
        Query: {
          me: {
            resolve: async (parent: unknown, args: unknown, ctx: any) => {
              const authUser = ctx.state.user;
              if (!authUser) return null;

              const entity = await strapi.entityService.findOne(
                'plugin::users-permissions.user',
                authUser.id,
                { populate: ['uuid', 'type'] }
              );

              const schema = strapi.contentType('plugin::users-permissions.user');
              const sanitized = await strapi.contentAPI.sanitize.output(entity, schema, {
                auth: ctx.state.auth,
              });

              return sanitized;
            },
          },
        },
      },
      resolversConfig: {
        'Query.me': { auth: true },
      },
    });

    strapi.plugin('graphql').service('extension').use(extension);
  },
};