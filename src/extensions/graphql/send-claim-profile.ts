import crypto from 'crypto';
import { sendClaimProfileEmail } from '../../utils/email/claim-profile-template';

export const sendClaimProfileExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Mutation {
      sendClaimProfileEmail(email: String!): Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async sendClaimProfileEmail(parent, args) {
        try {
          const { email } = args;

          // Find user by email
          const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { email: email.toLowerCase() },
          });

          if (!user) {
            strapi.log.warn(`[SendClaimProfile] User not found for email: ${email}`);
            return false;
          }

          // Generate resetPasswordToken
          const resetPasswordToken = crypto.randomBytes(64).toString('hex');

          // Save token to user
          await strapi.entityService.update('plugin::users-permissions.user', user.id, {
            data: {
              resetPasswordToken,
            },
          });

          // Get frontendUrl from settings
          const settings = await strapi.query('api::setting.setting').findOne({});
          
          if (!settings || !settings.frontendUrl) {
            strapi.log.error('[SendClaimProfile] frontendUrl not found in settings');
            return false;
          }

          const url = `${settings.frontendUrl}/#/reset-password`;

          // Send email
          await sendClaimProfileEmail({
            email,
            code: resetPasswordToken,
            url,
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
