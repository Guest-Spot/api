/**
 * GraphQL extension for Stripe Connect onboarding
 */

import {
  createConnectAccount,
  createAccountLink,
  getConnectAccount,
  isAccountOnboarded,
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
    }

    extend type UsersPermissionsMe {
      stripeAccountID: String
      payoutsEnabled: Boolean
    }

    extend type Mutation {
      createStripeOnboardingUrl: StripeOnboardingUrl!
      refreshStripeOnboardingUrl: StripeOnboardingUrl!
      checkStripeAccountStatus: StripeAccountStatus!
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
              },
            });

            strapi.log.info(`Saved Stripe account ${accountId} to user ${user.id}`);
          }

          // Create onboarding link
          const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:3000';

          const accountLink = await createAccountLink({
            accountId,
            refreshUrl: `${frontendUrl}/artist/stripe-onboarding?refresh=true`,
            returnUrl: `${frontendUrl}/artist/stripe-onboarding/success`,
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
          const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:3000';

          const accountLink = await createAccountLink({
            accountId: user.stripeAccountID,
            refreshUrl: `${frontendUrl}/artist/stripe-onboarding?refresh=true`,
            returnUrl: `${frontendUrl}/artist/stripe-onboarding/success`,
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
          };
        } catch (error) {
          strapi.log.error('Error checking account status:', error);
          throw new Error('Failed to check account status');
        }
      },
    },
  },
  resolversConfig: {
    'Mutation.createStripeOnboardingUrl': { auth: true },
    'Mutation.refreshStripeOnboardingUrl': { auth: true },
    'Mutation.checkStripeAccountStatus': { auth: true },
  },
});

