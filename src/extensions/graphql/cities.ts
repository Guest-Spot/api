export const citiesExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      cities: [String!]!
    }
  `,
  resolvers: {
    Query: {
      async cities(parent, args, ctx) {
        const shops = await strapi
          .documents('api::shop.shop')
          .findMany({
            populate: ['location']
          });

        const artists = await strapi
          .documents('api::artist.artist')
          .findMany({
            populate: ['location']
          });

        const all = [
          ...shops.map(s => s?.location?.city).filter(Boolean),
          ...artists.map(a => a?.location?.city).filter(Boolean),
        ];

        return Array.from(new Set(all));
      },
    },
  },
  resolversConfig: {
    'Query.cities': { auth: false },
  },
});
