import fs from 'fs/promises';
import path from 'path';
import { formatDateOnly } from '../date';

const BOOKING_EXPIRED_TEMPLATE_NAME = 'booking-expired.html';

export type BookingExpiredEmailPayload = {
  userName?: string | null;
  userEmail?: string | null;
  artistName?: string | null;
  bookingId?: string | number | null;
  amount?: number | null;
  currency?: string | null;
  day?: string | null;
  start?: string | null;
};

let cachedBookingExpiredTemplate: string | null = null;

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

const formatTime = (timeString?: string | null): string => {
  if (!timeString) {
    return 'Not specified';
  }

  return timeString;
};

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src/utils/email', BOOKING_EXPIRED_TEMPLATE_NAME);

const loadBookingExpiredTemplate = async (): Promise<string> => {
  if (cachedBookingExpiredTemplate) {
    return cachedBookingExpiredTemplate;
  }

  const templatePath = getTemplatePath();
  cachedBookingExpiredTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedBookingExpiredTemplate;
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

const buildBookingExpiredHtml = async (
  payload: BookingExpiredEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadBookingExpiredTemplate();

  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());
  const formattedAmount = formatAmount(payload.amount, payload.currency);
  const formattedDay = formatDateOnly(payload.day);
  const formattedStart = formatTime(payload.start);

  const variables: Record<string, string> = {
    userName: toDisplayValue(payload.userName, 'User'),
    artistName: toDisplayValue(payload.artistName, 'Artist'),
    bookingId: toDisplayValue(payload.bookingId, 'N/A'),
    amount: escapeHtml(formattedAmount),
    day: escapeHtml(formattedDay),
    start: escapeHtml(formattedStart),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `Booking Expired`,
    ``,
    `Hi ${payload.userName ?? 'User'},`,
    ``,
    `Your booking request expired after 7 days without artist response. Payment authorization has been cancelled and your funds have been released.`,
    ``,
    `Booking Details:`,
    `- Booking ID: ${payload.bookingId ?? 'N/A'}`,
    `- Artist: ${payload.artistName ?? 'Artist'}`,
    `- Date: ${formattedDay}`,
    `- Time: ${formattedStart}`,
    `- Authorized Amount: ${formattedAmount} (Released)`,
    ``,
    `What Happened?`,
    `- Your booking request was automatically cancelled after 7 days without artist response.`,
    `- Payment authorization has been cancelled - your funds were never charged and are now fully released.`,
    `- You can create a new booking request with this or any other artist at any time.`,
    ``,
    `Thank you,`,
    `GuestSpot Team`,
  ];

  return {
    html,
    subject: `Booking Expired - Payment Authorization Cancelled`,
    text: textLines.join('\n'),
  };
};

export const sendBookingExpiredEmail = async (
  payload: BookingExpiredEmailPayload,
): Promise<void> => {
  if (!payload.userEmail) {
    strapi.log.warn(
      '[BookingExpiredEmail] Cannot send email without user email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildBookingExpiredHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.userEmail,
      from: process.env.EMAIL_FROM,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[BookingExpiredEmail] Sent booking expired notification to ${payload.userEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      `[BookingExpiredEmail] Failed to send booking expired notification:`,
      error,
    );
  }
};

