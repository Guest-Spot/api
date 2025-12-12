import fs from 'fs/promises';
import path from 'path';

const PAYMENT_REQUIRED_TEMPLATE_NAME = 'payment-required.html';

export type PaymentRequiredEmailPayload = {
  guestName?: string | null;
  guestEmail?: string | null;
  artistName?: string | null;
  bookingId?: string | number | null;
  paymentUrl?: string | null;
  amount?: number | null;
  currency?: string | null;
};

let cachedPaymentRequiredTemplate: string | null = null;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toDisplayValue = (value: unknown, fallback = 'Not provided'): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? escapeHtml(trimmed) : fallback;
  }

  return escapeHtml(String(value));
};

const formatAmount = (amount?: number | null, currency?: string | null): string => {
  if (!amount) return 'N/A';
  
  const dollars = (amount / 100).toFixed(2);
  const currencySymbol = currency?.toUpperCase() === 'USD' ? '$' : currency?.toUpperCase() || '';
  
  return `${currencySymbol}${dollars}`;
};

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src/utils/email', PAYMENT_REQUIRED_TEMPLATE_NAME);

const loadPaymentRequiredTemplate = async (): Promise<string> => {
  if (cachedPaymentRequiredTemplate) {
    return cachedPaymentRequiredTemplate;
  }

  const templatePath = getTemplatePath();
  cachedPaymentRequiredTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedPaymentRequiredTemplate;
};

const renderTemplate = (
  template: string,
  variables: Record<string, string>,
): string => {
  let html = template;

  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`{{\\s*${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*}}`, 'g');
    html = html.replace(pattern, value);
  }

  return html;
};

const buildPaymentRequiredHtml = async (
  payload: PaymentRequiredEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadPaymentRequiredTemplate();

  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());
  const formattedAmount = formatAmount(payload.amount, payload.currency);

  const variables: Record<string, string> = {
    guestName: toDisplayValue(payload.guestName, 'Guest'),
    artistName: toDisplayValue(payload.artistName, 'Artist'),
    bookingId: toDisplayValue(payload.bookingId, 'N/A'),
    amount: escapeHtml(formattedAmount),
    paymentUrl: toDisplayValue(payload.paymentUrl, '#'),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `Payment Required for Your Booking`,
    ``,
    `Hi ${payload.guestName ?? 'Guest'},`,
    ``,
    `Good news! ${payload.artistName ?? 'The artist'} has accepted your booking request.`,
    ``,
    `To confirm your booking, please complete the payment of ${formattedAmount}.`,
    ``,
    `Click here to pay: ${payload.paymentUrl ?? 'See email for link'}`,
    ``,
    `Booking ID: ${payload.bookingId ?? 'N/A'}`,
    ``,
    `Thank you,`,
    `GuestSpot Team`,
  ];

  return {
    html,
    subject: `Payment Required - Booking Accepted by ${payload.artistName ?? 'Artist'}`,
    text: textLines.join('\n'),
  };
};

export const sendPaymentRequiredEmail = async (
  payload: PaymentRequiredEmailPayload,
): Promise<void> => {
  if (!payload.guestEmail) {
    strapi.log.warn(
      '[PaymentRequiredEmail] Cannot send email without guest email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildPaymentRequiredHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.guestEmail,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[PaymentRequiredEmail] Sent payment required notification to ${payload.guestEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      `[PaymentRequiredEmail] Failed to send payment required notification:`,
      error,
    );
  }
};

