import fs from 'fs/promises';
import path from 'path';
import { formatDateOnly } from '../date';

const GUEST_SPOT_BOOKING_REQUEST_TEMPLATE_NAME = 'guest-spot-booking-request.html';

export type GuestSpotBookingRequestEmailPayload = {
  shopEmail: string;
  shopName?: string | null;
  artistName?: string | null;
  artistEmail?: string | null;
  artistDescription?: string | null;
  artistCity?: string | null;
  artistLink?: string | null;
  selectedDate?: string | null;
  selectedTime?: string | null;
  slotTitle?: string | null;
  comment?: string | null;
  bookingDocumentId?: string | null;
};

let cachedTemplate: string | null = null;

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

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src/utils/email', GUEST_SPOT_BOOKING_REQUEST_TEMPLATE_NAME);

const loadTemplate = async (): Promise<string> => {
  if (cachedTemplate) {
    return cachedTemplate;
  }
  const templatePath = getTemplatePath();
  cachedTemplate = await fs.readFile(templatePath, 'utf-8');
  return cachedTemplate;
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

const formatTime = (timeString?: string | null): string => {
  if (!timeString) {
    return 'Not specified';
  }
  return timeString;
};

const getViewBookingUrl = (bookingDocumentId?: string | null): string => {
  const base = process.env.FRONTEND_URL || process.env.FRONTEND_AUTH_URL || '';
  const trimmed = base.trim().replace(/\/$/, '');
  if (!trimmed || !bookingDocumentId) {
    return '';
  }
  return `${trimmed}/guest-spot/bookings/${encodeURIComponent(bookingDocumentId)}`;
};

const buildGuestSpotBookingRequestHtml = async (
  payload: GuestSpotBookingRequestEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadTemplate();

  const submittedAt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date());
  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());

  const viewBookingUrl = getViewBookingUrl(payload.bookingDocumentId);

  const commentDisplay = payload.comment?.trim()
    ? toDisplayValue(payload.comment)
    : 'No comment provided';

  const variables: Record<string, string> = {
    shopName: toDisplayValue(payload.shopName, 'Shop'),
    artistName: toDisplayValue(payload.artistName, 'Artist'),
    artistEmail: payload.artistEmail?.trim() ? toDisplayValue(payload.artistEmail) : '—',
    artistDescription: payload.artistDescription?.trim() ? toDisplayValue(payload.artistDescription) : '—',
    artistCity: payload.artistCity?.trim() ? toDisplayValue(payload.artistCity) : '—',
    artistLink: payload.artistLink?.trim() ? toDisplayValue(payload.artistLink) : '—',
    selectedDate: formatDateOnly(payload.selectedDate),
    selectedTime: formatTime(payload.selectedTime),
    slotTitle: toDisplayValue(payload.slotTitle, 'Guest spot slot'),
    comment: commentDisplay,
    submittedAt: escapeHtml(submittedAt),
    currentYear: escapeHtml(currentYear),
    viewBookingUrl: viewBookingUrl ? escapeHtml(viewBookingUrl) : '#',
    hasViewLink: viewBookingUrl ? 'true' : '',
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    'New guest spot booking request',
    `Artist: ${payload.artistName ?? 'An artist'}`,
    payload.artistEmail ? `Artist email: ${payload.artistEmail}` : '',
    payload.artistCity ? `Artist city: ${payload.artistCity}` : '',
    payload.artistLink ? `Artist link: ${payload.artistLink}` : '',
    payload.artistDescription ? `Artist: ${payload.artistDescription}` : '',
    `Date: ${formatDateOnly(payload.selectedDate)}`,
    `Time: ${formatTime(payload.selectedTime)}`,
    payload.slotTitle ? `Slot: ${payload.slotTitle}` : '',
    `Comment from artist: ${payload.comment?.trim() || 'No comment provided'}`,
    `Submitted: ${submittedAt}`,
    viewBookingUrl ? `View in app: ${viewBookingUrl}` : '',
  ].filter(Boolean);

  return {
    html,
    subject: `New guest spot request from ${payload.artistName ?? 'an artist'}`,
    text: textLines.join('\n'),
  };
};

export const sendGuestSpotBookingRequestEmail = async (
  payload: GuestSpotBookingRequestEmailPayload,
): Promise<void> => {
  if (!payload.shopEmail?.trim()) {
    strapi.log.warn(
      '[GuestSpotBookingRequestEmail] Cannot send email without shop email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildGuestSpotBookingRequestHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.shopEmail.trim(),
      from: process.env.EMAIL_FROM,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[GuestSpotBookingRequestEmail] Sent guest spot booking request notification to ${payload.shopEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      '[GuestSpotBookingRequestEmail] Failed to send guest spot booking request notification:',
      error,
    );
  }
};
