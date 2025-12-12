import fs from 'fs/promises';
import path from 'path';

const PAYMENT_SUCCESS_TEMPLATE_NAME = 'payment-success.html';

export type PaymentSuccessEmailPayload = {
  userName?: string | null;
  userEmail?: string | null;
  artistName?: string | null;
  bookingId?: string | number | null;
  amount?: number | null;
  currency?: string | null;
  isArtist?: boolean;
};

let cachedPaymentSuccessTemplate: string | null = null;

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
  path.join(strapi.dirs.app.root, 'src/utils/email', PAYMENT_SUCCESS_TEMPLATE_NAME);

const loadPaymentSuccessTemplate = async (): Promise<string> => {
  if (cachedPaymentSuccessTemplate) {
    return cachedPaymentSuccessTemplate;
  }

  const templatePath = getTemplatePath();
  cachedPaymentSuccessTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedPaymentSuccessTemplate;
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

const buildPaymentSuccessHtml = async (
  payload: PaymentSuccessEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadPaymentSuccessTemplate();

  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());
  const formattedAmount = formatAmount(payload.amount, payload.currency);

  const message = payload.isArtist
    ? `You have received a payment for your booking.`
    : `Your payment has been processed successfully. Your booking is confirmed!`;

  const variables: Record<string, string> = {
    userName: toDisplayValue(payload.userName, 'User'),
    artistName: toDisplayValue(payload.artistName, 'Artist'),
    bookingId: toDisplayValue(payload.bookingId, 'N/A'),
    amount: escapeHtml(formattedAmount),
    message: escapeHtml(message),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `Payment Successful`,
    ``,
    `Hi ${payload.userName ?? 'User'},`,
    ``,
    message,
    ``,
    `Amount: ${formattedAmount}`,
    `Booking ID: ${payload.bookingId ?? 'N/A'}`,
    `Artist: ${payload.artistName ?? 'Artist'}`,
    ``,
    `Thank you,`,
    `GuestSpot Team`,
  ];

  return {
    html,
    subject: `Payment Successful - Booking #${payload.bookingId ?? 'N/A'}`,
    text: textLines.join('\n'),
  };
};

export const sendPaymentSuccessEmail = async (
  payload: PaymentSuccessEmailPayload,
): Promise<void> => {
  if (!payload.userEmail) {
    strapi.log.warn(
      '[PaymentSuccessEmail] Cannot send email without user email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildPaymentSuccessHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.userEmail,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[PaymentSuccessEmail] Sent payment success notification to ${payload.userEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      `[PaymentSuccessEmail] Failed to send payment success notification:`,
      error,
    );
  }
};

