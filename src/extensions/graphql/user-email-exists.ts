import { checkUserEmailExists } from '../../utils/checkUserEmailExists';

export const userEmailExistsExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      userEmailExists(email: String!): Boolean!
    }
  `,
  resolvers: {
    Query: {
      async userEmailExists(parent, args) {
        return checkUserEmailExists(strapi, args?.email);
      },
    },
  },
  resolversConfig: {
    'Query.userEmailExists': { auth: false },
  },
});
