export const citiesExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      cities: [String!]!
    }
  `,
  resolvers: {
    Query: {
      async cities(parent, args, ctx) {
        const users = await strapi
          .documents('plugin::users-permissions.user')
          .findMany();

        const all = [
          ...users.map(u => u?.city).filter(Boolean),
        ];

        return Array.from(new Set(all));
      },
    },
  },
  resolversConfig: {
    'Query.cities': { auth: false },
  },
});
