/**
 * Tip Stripe webhook router
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/tip/webhooks/stripe',
      handler: 'webhook.handleStripeWebhook',
      config: {
        auth: false, // No authentication required for webhooks
        policies: [],
        middlewares: [],
      },
    },
  ],
};
