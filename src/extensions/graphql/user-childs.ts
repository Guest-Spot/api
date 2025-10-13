export const userChildsExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      userChilds(documentId: ID!): [UsersPermissionsUser!]!
    }
  `,
  resolvers: {
    Query: {
      async userChilds(parent, args, ctx) {
        const { documentId } = args;

        if (!documentId) {
          throw new Error('documentId is required');
        }

        // Find the shop by documentId
        const user = await strapi
          .documents('api::users-permissions.user')
          .findOne({
            documentId,
            populate: ['childs']
          });


        if (!user) {
          throw new Error(`User with documentId ${documentId} not found`);
        }

        // Return the artists associated with this shop
        return user.childs || [];
      },
    },
  },
  resolversConfig: {
    'Query.userChilds': { auth: false },
  },
});
