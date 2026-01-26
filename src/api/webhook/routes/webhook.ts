/**
 * Stripe webhook router
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/stripe',
      handler: 'webhook.handleStripeWebhook',
      config: {
        auth: false, // No authentication required for webhooks
        policies: [],
        middlewares: [],
      },
    },
  ],
};
