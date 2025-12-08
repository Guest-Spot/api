import { sendClaimProfileEmail } from '../../utils/email/claim-profile-template';

export const sendClaimProfileExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Mutation {
      sendClaimProfileEmail(email: String!, code: String!, url: String!): Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async sendClaimProfileEmail(parent, args) {
        try {
          await sendClaimProfileEmail({
            email: args.email,
            code: args.code,
            url: args.url,
          });
          return true;
        } catch (error) {
          strapi.log.error('Failed to send claim profile email', error);
          return false;
        }
      },
    },
  },
  resolversConfig: {
    'Mutation.sendClaimProfileEmail': { auth: false },
  },
});
