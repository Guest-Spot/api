/**
 * Tip Stripe webhook controller
 */

import { verifyWebhookSignature, isStripeEnabled } from '../../../utils/stripe';
import Stripe from 'stripe';
import {
  handleTipCheckoutSessionCompleted,
  handleCheckoutSessionAsyncPaymentSucceeded,
  handleCheckoutSessionAsyncPaymentFailed,
  handleTipPaymentIntentSucceeded,
  handleTipPaymentIntentFailed,
  handleTipPaymentIntentCanceled,
} from '../services/webhook';

export default {
  /**
   * Handle Stripe webhook events for tips
   * POST /api/tip/webhooks/stripe
   */
  async handleStripeWebhook(ctx) {
    // Check if Stripe is enabled
    const stripeEnabled = await isStripeEnabled();
    if (!stripeEnabled) {
      strapi.log.warn('Stripe is disabled, ignoring tip webhook event');
      return ctx.badRequest('Stripe payments are disabled');
    }

    const sig = ctx.request.headers['stripe-signature'];
    const webhookSecret =
      process.env.STRIPE_TIP_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      '';

    strapi.log.debug('Tip webhook request received');

    if (!webhookSecret) {
      strapi.log.error(
        'STRIPE_TIP_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET fallback) is not configured'
      );
      return ctx.badRequest('Webhook secret not configured');
    }

    if (!sig) {
      strapi.log.error('Missing stripe-signature header');
      return ctx.badRequest('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Get raw body for signature verification
      const rawBody = ctx.request.body[Symbol.for('unparsedBody')];
      
      if (!rawBody) {
        strapi.log.error('Missing raw body - make sure includeUnparsed is enabled in middlewares config');
        return ctx.badRequest('Missing raw body');
      }

      strapi.log.debug('Raw body received, verifying signature...');

      // Verify webhook signature
      event = await verifyWebhookSignature(rawBody, sig, webhookSecret);
      
      strapi.log.debug('Signature verified successfully');
    } catch (error) {
      strapi.log.error('Tip webhook signature verification failed:', error);
      return ctx.badRequest('Invalid signature');
    }

    strapi.log.info(`Received Stripe tip webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleTipCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.async_payment_succeeded':
          await handleCheckoutSessionAsyncPaymentSucceeded(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.async_payment_failed':
          await handleCheckoutSessionAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.succeeded':
          await handleTipPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await handleTipPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await handleTipPaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          strapi.log.info(`Unhandled tip webhook event type: ${event.type}`);
      }

      ctx.send({ received: true });
    } catch (error) {
      strapi.log.error('Error processing tip webhook:', error);
      ctx.badRequest('Error processing tip webhook');
    }
  },
};
