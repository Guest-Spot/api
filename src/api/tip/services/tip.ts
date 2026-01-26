/**
 * Tip service
 *
 * Responsible for creating Stripe Checkout Sessions for tips and storing tip records.
 */

import { factories } from '@strapi/strapi';
import { getDefaultCurrency, getStripeClient, isStripeEnabled } from '../../../utils/stripe';

export default factories.createCoreService('api::tip.tip', ({ strapi }) => ({
  /**
   * Create Stripe Checkout Session for a tip payment and persist the tip record.
   */
  async createTipPaymentSession(params: {
    artistDocumentId: string;
    amount: number;
    customerEmail?: string | null;
  }): Promise<{ sessionId: string; sessionUrl: string }> {
    const { artistDocumentId, amount, customerEmail } = params;

    if (!artistDocumentId) {
      throw new Error('Artist ID is required');
    }

    const normalizedAmount = Math.round(Number(amount));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('Invalid tip amount');
    }

    const stripeEnabled = await isStripeEnabled();
    if (!stripeEnabled) {
      throw new Error('Stripe payments are disabled');
    }

    const artist = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: artistDocumentId,
    });

    if (!artist || artist.type !== 'artist') {
      throw new Error('Artist not found');
    }

    if (artist.acceptTips === false) {
      throw new Error('Artist is not accepting tips');
    }

    if (artist.payoutsEnabled !== true) {
      throw new Error('Artist is not accepting tips');
    }

    if (!artist.stripeAccountID) {
      throw new Error('Artist payment account not configured');
    }

    const currency = getDefaultCurrency();
    const normalizedEmail = customerEmail?.trim();

    const tipRecord = await strapi.documents('api::tip.tip').create({
      data: {
        artist: artist.id,
        artistDocumentId,
        amount: normalizedAmount,
        currency,
        customerEmail: normalizedEmail || null,
        status: 'pending',
      },
      status: 'published',
    });

    const sessionMetadata: Record<string, string> = {
      type: 'tip',
      artistDocumentId,
      tipDocumentId: tipRecord.documentId,
    };

    if (normalizedEmail) {
      sessionMetadata.customerEmail = normalizedEmail;
    }

    const stripe = await getStripeClient();
    const settings = await strapi.query('api::setting.setting').findOne({});
    const successUrl =
      settings?.stripeSuccessUrl ||
      process.env.STRIPE_SUCCESS_URL ||
      'https://getguestspot.com/payment-success';
    const cancelUrl =
      settings?.stripeCancelUrl ||
      process.env.STRIPE_CANCEL_URL ||
      `https://getguestspot.com/artist/${artistDocumentId}/tip`;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        ...(normalizedEmail ? { customer_email: normalizedEmail } : {}),
        payment_intent_data: {
          on_behalf_of: artist.stripeAccountID,
          transfer_data: {
            destination: artist.stripeAccountID,
          },
          metadata: sessionMetadata,
        },
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: 'Tip',
                description: `Tip for ${artist.username || 'artist'}`,
              },
              unit_amount: normalizedAmount,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: sessionMetadata,
      });

      if (!session.url) {
        throw new Error('Stripe checkout session URL is missing');
      }

      await strapi.documents('api::tip.tip').update({
        documentId: tipRecord.documentId,
        data: {
          sessionId: session.id,
          metadata: sessionMetadata,
        },
        status: 'published',
      });

      strapi.log.info(`Created tip session ${session.id} for artist ${artistDocumentId}`);

      return {
        sessionId: session.id,
        sessionUrl: session.url || '',
      };
    } catch (error) {
      await strapi.documents('api::tip.tip').update({
        documentId: tipRecord.documentId,
        data: {
          status: 'failed',
        },
        status: 'published',
      });

      strapi.log.error('Error creating tip checkout session:', error);
      throw error;
    }
  },

  /**
   * Helper: Find tip record by Stripe Checkout session ID
   */
  async findBySessionId(sessionId: string) {
    if (!sessionId) {
      return null;
    }

    return strapi.db.query('api::tip.tip').findOne({
      where: { sessionId },
      populate: ['artist'],
    });
  },

  /**
   * Helper: Find tip record by document ID
   */
  async findByDocumentId(documentId: string) {
    if (!documentId) {
      return null;
    }

    return strapi.db.query('api::tip.tip').findOne({
      where: { documentId },
      populate: ['artist'],
    });
  },
}));
