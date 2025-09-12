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
          .findMany();

        const all = [
          ...shops.map(s => s?.city).filter(Boolean),
        ];

        return Array.from(new Set(all));
      },
    },
  },
  resolversConfig: {
    'Query.cities': { auth: false },
  },
});
