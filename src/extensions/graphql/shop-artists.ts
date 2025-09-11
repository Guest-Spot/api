export const shopArtistsExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      shopArtists(documentId: ID!): [Artist!]!
    }
  `,
  resolvers: {
    Query: {
      async shopArtists(parent, args, ctx) {
        const { documentId } = args;

        if (!documentId) {
          throw new Error('documentId is required');
        }

        // Find the shop by documentId
        const shop = await strapi
          .documents('api::shop.shop')
          .findOne({
            documentId,
            populate: ['artists']
          });

        if (!shop) {
          throw new Error(`Shop with documentId ${documentId} not found`);
        }

        // Return the artists associated with this shop
        return shop.artists || [];
      },
    },
  },
  resolversConfig: {
    'Query.shopArtists': { auth: false },
  },
});
