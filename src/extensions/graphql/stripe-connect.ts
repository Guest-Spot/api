/**
 * GraphQL extension for Stripe Connect onboarding
 */

import {
  createConnectAccount,
  createAccountLink,
  getConnectAccount,
  isAccountOnboarded,
  createLoginLink,
} from '../../utils/stripe';

export const stripeConnectExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    type StripeOnboardingUrl {
      url: String!
      accountId: String!
      expiresAt: Int!
    }

    type StripeAccountStatus {
      accountId: String
      onboarded: Boolean!
      payoutsEnabled: Boolean!
      chargesEnabled: Boolean!
      detailsSubmitted: Boolean!
      verified: Boolean!
    }

    type StripeDashboardUrl {
      url: String!
      accountId: String!
    }

    extend type UsersPermissionsMe {
      stripeAccountID: String
      payoutsEnabled: Boolean
      verified: Boolean
    }

    extend type Mutation {
      createStripeOnboardingUrl: StripeOnboardingUrl!
      refreshStripeOnboardingUrl: StripeOnboardingUrl!
      checkStripeAccountStatus: StripeAccountStatus!
      getStripeDashboardUrl: StripeDashboardUrl!
    }
  `,
  resolvers: {
    Mutation: {
      /**
       * Create Stripe Connect onboarding URL for the current user
       * Creates a new Stripe account if user doesn't have one
       */
      async createStripeOnboardingUrl(parent, args, context) {
        const userId = context.state?.user?.id;

        if (!userId) {
          throw new Error('You must be logged in');
        }

        // Get user
        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: context.state.user.documentId,
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Check if user is an artist
        if (user.type !== 'artist') {
          throw new Error('Only artists can create Stripe Connect accounts');
        }

        let accountId = user.stripeAccountID;

        try {
          // Create Stripe account if doesn't exist
          if (!accountId) {
            const account = await createConnectAccount({
              email: user.email,
              type: 'express', // Express accounts are easier for artists
              country: 'US', // You can make this configurable
            });

            accountId = account.id;

            // Save account ID to user
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: user.documentId,
              data: {
                stripeAccountID: accountId,
                payoutsEnabled: false,
                verified: false,
              },
            });

            strapi.log.info(`Saved Stripe account ${accountId} to user ${user.id}`);
          }
          const settings = await strapi.query('api::setting.setting').findOne({});
          // Create onboarding link
          const accountLink = await createAccountLink({
            accountId,
            refreshUrl: settings?.stripeRestartOnboardingUrl,
            returnUrl: settings?.stripeSuccessOnboardingUrl,
            type: 'account_onboarding',
          });

          return {
            url: accountLink.url,
            accountId,
            expiresAt: accountLink.expires_at,
          };
        } catch (error) {
          strapi.log.error('Error creating onboarding URL:', error);
          throw new Error('Failed to create onboarding URL');
        }
      },

      /**
       * Refresh onboarding URL if expired
       */
      async refreshStripeOnboardingUrl(parent, args, context) {
        const userId = context.state?.user?.id;

        if (!userId) {
          throw new Error('You must be logged in');
        }

        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: context.state.user.documentId,
        });

        if (!user || !user.stripeAccountID) {
          throw new Error('Stripe account not found. Please create one first.');
        }

        try {
          const settings = await strapi.query('api::setting.setting').findOne({});

          const accountLink = await createAccountLink({
            accountId: user.stripeAccountID,
            refreshUrl: settings?.stripeRestartOnboardingUrl,
            returnUrl: settings?.stripeSuccessOnboardingUrl,
            type: 'account_onboarding',
          });

          return {
            url: accountLink.url,
            accountId: user.stripeAccountID,
            expiresAt: accountLink.expires_at,
          };
        } catch (error) {
          strapi.log.error('Error refreshing onboarding URL:', error);
          throw new Error('Failed to refresh onboarding URL');
        }
      },

      /**
       * Check Stripe account onboarding status
       * Updates user's payoutsEnabled field if status changed
       */
      async checkStripeAccountStatus(parent, args, context) {
        const userId = context.state?.user?.id;

        if (!userId) {
          throw new Error('You must be logged in');
        }

        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: context.state.user.documentId,
        });

        if (!user?.stripeAccountID) {
          return {
            accountId: null,
            onboarded: false,
            payoutsEnabled: false,
            chargesEnabled: false,
            detailsSubmitted: false,
            verified: user?.verified === true,
          };
        }

        try {
          const account = await getConnectAccount(user.stripeAccountID);
          const onboarded = isAccountOnboarded(account);

          // Update user if status changed
          if (onboarded !== user.payoutsEnabled) {
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: user.documentId,
              data: {
                payoutsEnabled: onboarded,
              },
            });

            strapi.log.info(
              `Updated payoutsEnabled to ${onboarded} for user ${user.id}`
            );
          }

          return {
            accountId: account.id,
            onboarded,
            payoutsEnabled: account.payouts_enabled || false,
            chargesEnabled: account.charges_enabled || false,
            detailsSubmitted: account.details_submitted || false,
            verified: user.verified === true,
          };
        } catch (error) {
          strapi.log.error('Error checking account status:', error);
          throw new Error('Failed to check account status');
        }
      },

      /**
       * Get Stripe Express Dashboard URL (simplified for adding bank details)
       * Creates Stripe account automatically if it doesn't exist
       * This is the recommended simplified approach for artists
       */
      async getStripeDashboardUrl(parent, args, context) {
        const userId = context.state?.user?.id;

        if (!userId) {
          throw new Error('You must be logged in');
        }

        const user = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: context.state.user.documentId,
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Check if user is an artist
        if (user.type !== 'artist') {
          throw new Error('Only artists can access Stripe Dashboard');
        }

        let accountId = user.stripeAccountID;

        try {
          // Auto-create Stripe account if doesn't exist
          if (!accountId) {
            // Prepare prefill data from user profile to reduce onboarding friction
            const createAccountParams: any = {
              email: user.email,
              type: 'express',
              country: 'US', // Make this configurable based on user location
            };

            // Prefill name if available
            if (user.username) {
              const nameParts = user.username.split(' ');
              if (nameParts.length >= 2) {
                createAccountParams.firstName = nameParts[0];
                createAccountParams.lastName = nameParts.slice(1).join(' ');
              }
            }

            // Prefill phone if available
            if (user.phone) {
              createAccountParams.phone = user.phone;
            }

            const account = await createConnectAccount(createAccountParams);

            accountId = account.id;

            // Save account ID to user
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: user.documentId,
              data: {
                stripeAccountID: accountId,
                payoutsEnabled: false,
                verified: false,
              },
            });

            strapi.log.info(`Auto-created Stripe account ${accountId} for user ${user.id}`);
          }

          // Check if account has completed onboarding
          const account = await getConnectAccount(accountId);
          const onboarded = isAccountOnboarded(account);

          const settings = await strapi.query('api::setting.setting').findOne({});

          let dashboardUrl;

          if (onboarded) {
            // For onboarded accounts, use Login Link to access Dashboard
            const loginLink = await createLoginLink(accountId);
            dashboardUrl = loginLink.url;
            strapi.log.info(`Created login link for onboarded account ${accountId}`);
          } else {
            // For new accounts, use Account Link for simplified onboarding
            const accountLink = await createAccountLink({
              accountId,
              refreshUrl: settings?.stripeRestartOnboardingUrl,
              returnUrl: settings?.stripeSuccessOnboardingUrl,
              type: 'account_onboarding',
            });
            dashboardUrl = accountLink.url;
            strapi.log.info(`Created onboarding link for new account ${accountId}`);
          }

          return {
            url: dashboardUrl,
            accountId,
          };
        } catch (error) {
          strapi.log.error('Error creating dashboard URL:', error);
          throw new Error(error);
        }
      },
    },
  },
  resolversConfig: {
    'Mutation.createStripeOnboardingUrl': { auth: true },
    'Mutation.refreshStripeOnboardingUrl': { auth: true },
    'Mutation.checkStripeAccountStatus': { auth: true },
    'Mutation.getStripeDashboardUrl': { auth: true },
  },
});
