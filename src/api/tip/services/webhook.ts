/**
 * Tip webhook handlers
 * Handles Stripe webhook events related to tip payments
 */

import Stripe from 'stripe';
import { sendFirebaseNotificationToUser } from '../../../utils/push-notification';
import { NotifyType } from '../../../interfaces/enums';

type TipStatus = 'pending' | 'completed' | 'failed' | 'canceled';

/**
 * Handle checkout.session.completed event for tips
 */
export async function handleTipCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') {
    strapi.log.info(
      `Tip checkout session ${session.id} completed with payment_status=${session.payment_status}`
    );
    await updateTipSessionFields(session);
    return;
  }

  await handleTipSessionByStatus(session, 'completed');
}

/**
 * Handle checkout.session.async_payment_succeeded event for tips
 */
export async function handleCheckoutSessionAsyncPaymentSucceeded(session: Stripe.Checkout.Session) {
  await handleTipSessionByStatus(session, 'completed');
}

/**
 * Handle checkout.session.async_payment_failed event for tips
 */
export async function handleCheckoutSessionAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  await handleTipSessionByStatus(session, 'failed');
}

/**
 * Handle payment_intent.succeeded event for tips
 */
export async function handleTipPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  await handleTipPaymentIntentTransition(paymentIntent, 'completed');
}

/**
 * Handle payment_intent.payment_failed event for tips
 */
export async function handleTipPaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await handleTipPaymentIntentTransition(paymentIntent, 'failed');
}

/**
 * Handle payment_intent.canceled event for tips
 */
export async function handleTipPaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  await handleTipPaymentIntentTransition(paymentIntent, 'canceled');
}

/**
 * Handle tip session status updates
 */
async function handleTipSessionByStatus(
  session: Stripe.Checkout.Session,
  status: TipStatus
) {
  if (session.metadata?.type !== 'tip') {
    return;
  }

  const sessionId = session.id;

  if (!sessionId) {
    strapi.log.error('Stripe session payload missing ID for tip event');
    return;
  }

  const tipService = strapi.service('api::tip.tip');
  const tip = await tipService.findBySessionId(sessionId);

  if (!tip) {
    strapi.log.warn(`Tip record not found for session ${sessionId}`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
  const customerId =
    typeof session.customer === 'string' ? session.customer : undefined;

  const payload: Record<string, unknown> = {};

  if (paymentIntentId) {
    payload.paymentIntentId = paymentIntentId;
  }

  if (customerId) {
    payload.customerId = customerId;
  }

  await finalizeTipRecord(tip, status, payload);
}

/**
 * Handle tip payment intent status transitions
 */
async function handleTipPaymentIntentTransition(
  paymentIntent: Stripe.PaymentIntent,
  status: TipStatus
) {
  const tipDocumentId = paymentIntent.metadata?.tipDocumentId;

  if (!tipDocumentId) {
    strapi.log.error('Stripe payment intent missing tipDocumentId metadata');
    return;
  }

  const tipService = strapi.service('api::tip.tip');
  const tip = await tipService.findByDocumentId(tipDocumentId);

  if (!tip) {
    strapi.log.error(`Tip ${tipDocumentId} not found`);
    return;
  }

  const payload: Record<string, unknown> = {
    paymentIntentId: paymentIntent.id,
  };

  if (typeof paymentIntent.customer === 'string') {
    payload.customerId = paymentIntent.customer;
  }

  await finalizeTipRecord(tip, status, payload);
}

/**
 * Finalize tip record with status and additional fields
 */
async function finalizeTipRecord(
  tip: any,
  status: TipStatus,
  fields: Record<string, unknown> = {}
) {
  const updates: Record<string, unknown> = {};

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) {
      updates[key] = value;
    }
  });

  if (status === 'completed' && tip.status !== 'completed') {
    updates.completedAt = new Date().toISOString();
  }

  await strapi.documents('api::tip.tip').update({
    documentId: tip.documentId,
    data: {
      status,
      ...updates,
    },
    status: 'published',
  });

  if (status === 'completed' && tip.status !== 'completed') {
    await notifyArtistTipReceived({
      artistId: tip.artist?.id,
      tipDocumentId: tip.documentId,
      amount: tip.amount,
      currency: tip.currency,
    });
    strapi.log.info(`Tip ${tip.documentId} marked as completed`);
  }
}

/**
 * Persist session fields without changing tip status
 */
async function updateTipSessionFields(session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== 'tip') {
    return;
  }

  const sessionId = session.id;

  if (!sessionId) {
    strapi.log.error('Stripe session payload missing ID for tip event');
    return;
  }

  const tipService = strapi.service('api::tip.tip');
  const tip = await tipService.findBySessionId(sessionId);

  if (!tip) {
    strapi.log.warn(`Tip record not found for session ${sessionId}`);
    return;
  }

  const updates: Record<string, unknown> = {};
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
  const customerId =
    typeof session.customer === 'string' ? session.customer : undefined;

  if (paymentIntentId) {
    updates.paymentIntentId = paymentIntentId;
  }

  if (customerId) {
    updates.customerId = customerId;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  await strapi.documents('api::tip.tip').update({
    documentId: tip.documentId,
    data: updates,
    status: 'published',
  });
}

/**
 * Send notification to artist when tip is received
 */
async function notifyArtistTipReceived(params: {
  artistId?: number | null;
  tipDocumentId: string;
  amount?: number;
  currency?: string;
}) {
  const { artistId, tipDocumentId, amount, currency } = params;

  if (!artistId) {
    strapi.log.warn(`Cannot notify tip ${tipDocumentId} - artist ID missing`);
    return;
  }

  const formattedAmount =
    typeof amount === 'number' ? (amount / 100).toFixed(2) : null;
  const currencyCode = currency?.toUpperCase() || 'USD';
  const body = formattedAmount
    ? `You received a tip for ${currencyCode} ${formattedAmount}`
    : 'You received a tip';

  try {
    await sendFirebaseNotificationToUser(artistId, {
      title: 'Tip Received',
      body,
      data: {
        tipId: tipDocumentId,
        type: NotifyType.TIP_RECEIVED,
      },
    });
  } catch (error) {
    strapi.log.error('Error sending tip notification:', error);
  }
}
