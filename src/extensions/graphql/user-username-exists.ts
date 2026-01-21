import { checkUserUsernameExists } from '../../utils/checkUserEmailExists';

export const userUsernameExistsExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Query {
      userUsernameExists(username: String!): Boolean!
    }
  `,
  resolvers: {
    Query: {
      async userUsernameExists(parent, args) {
        return checkUserUsernameExists(strapi, args?.username);
      },
    },
  },
  resolversConfig: {
    'Query.userUsernameExists': { auth: false },
  },
});
