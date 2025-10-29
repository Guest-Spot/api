import fs from 'fs/promises';
import path from 'path';
import { formatDateOnly } from '../date';

const BOOKING_RESPONSE_TEMPLATE_NAME = 'booking-response.html';

export type BookingResponseEmailPayload = {
  guestName?: string | null;
  guestEmail?: string | null;
  artistName?: string | null;
  reaction: 'accepted' | 'rejected';
  day?: string | null;
  start?: string | null;
  location?: string | null;
  rejectNote?: string | null;
};

let cachedBookingResponseTemplate: string | null = null;

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
  path.join(strapi.dirs.app.root, 'src/utils/email', BOOKING_RESPONSE_TEMPLATE_NAME);

const loadBookingResponseTemplate = async (): Promise<string> => {
  if (cachedBookingResponseTemplate) {
    return cachedBookingResponseTemplate;
  }

  const templatePath = getTemplatePath();
  cachedBookingResponseTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedBookingResponseTemplate;
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

const formatDate = (dateString?: string | null): string =>
  formatDateOnly(dateString);

const formatTime = (timeString?: string | null): string => {
  if (!timeString) {
    return 'Not specified';
  }

  return timeString;
};

const getStatusInfo = (reaction: 'accepted' | 'rejected', artistName: string) => {
  if (reaction === 'accepted') {
    return {
      statusLabel: 'Accepted',
      statusMessage: `Great news! <strong>${artistName}</strong> has accepted your booking request. They will contact you soon to confirm the details.`,
    };
  }

  return {
    statusLabel: 'Rejected',
    statusMessage: `Unfortunately, <strong>${artistName}</strong> is unable to accept your booking request at this time.`,
  };
};

const buildRejectNoteSection = (rejectNote?: string | null): string => {
  if (!rejectNote || !rejectNote.trim()) {
    return '';
  }

  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">
                  <tr>
                    <td style="font-size:16px;font-weight:600;color:#ffffff;padding-bottom:12px;">Artist's Note</td>
                  </tr>
                  <tr>
                    <td style="background-color:#151515;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;font-size:15px;line-height:1.6;color:#e0e0e0;">
                      ${escapeHtml(rejectNote.trim())}
                    </td>
                  </tr>
                </table>`;
};

const buildBookingResponseHtml = async (
  payload: BookingResponseEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadBookingResponseTemplate();

  const currentYear = new Date().getFullYear().toString();
  const artistName = payload.artistName || 'Artist';
  const guestName = payload.guestName || 'Guest';
  const statusInfo = getStatusInfo(payload.reaction, artistName);

  const rejectNoteSection = payload.reaction === 'rejected'
    ? buildRejectNoteSection(payload.rejectNote)
    : '';

  const variables: Record<string, string> = {
    guestName: toDisplayValue(guestName),
    artistName: toDisplayValue(artistName),
    status: payload.reaction,
    statusLabel: statusInfo.statusLabel,
    statusMessage: statusInfo.statusMessage,
    day: formatDate(payload.day),
    start: formatTime(payload.start),
    location: toDisplayValue(payload.location, 'Not specified'),
    rejectNoteSection,
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `Booking ${statusInfo.statusLabel}`,
    `Artist: ${artistName}`,
    `Date: ${formatDate(payload.day)}`,
    `Time: ${formatTime(payload.start)}`,
    `Location: ${payload.location ?? 'Not specified'}`,
  ];

  if (payload.reaction === 'rejected' && payload.rejectNote) {
    textLines.push(`Artist's Note: ${payload.rejectNote}`);
  }

  return {
    html,
    subject: `Booking ${statusInfo.statusLabel} - ${artistName}`,
    text: textLines.join('\n'),
  };
};

export const sendBookingResponseEmail = async (
  payload: BookingResponseEmailPayload,
): Promise<void> => {
  if (!payload.guestEmail) {
    strapi.log.warn(
      '[BookingResponseEmail] Cannot send email without guest email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildBookingResponseHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.guestEmail,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[BookingResponseEmail] Sent booking ${payload.reaction} notification to ${payload.guestEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      `[BookingResponseEmail] Failed to send booking response notification:`,
      error,
    );
  }
};
