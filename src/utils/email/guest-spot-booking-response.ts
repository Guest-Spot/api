import fs from 'fs/promises';
import path from 'path';
import { formatDateOnly } from '../date';

const GUEST_SPOT_BOOKING_RESPONSE_TEMPLATE_NAME = 'guest-spot-booking-response.html';

export type GuestSpotBookingResponseEmailPayload = {
  artistEmail?: string | null;
  shopName?: string | null;
  reaction: 'accepted' | 'rejected';
  selectedDate?: string | null;
  selectedTime?: string | null;
  slotTitle?: string | null;
  rejectNote?: string | null;
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
  path.join(strapi.dirs.app.root, 'src/utils/email', GUEST_SPOT_BOOKING_RESPONSE_TEMPLATE_NAME);

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

const getStatusInfo = (reaction: 'accepted' | 'rejected', shopName: string) => {
  if (reaction === 'accepted') {
    return {
      statusLabel: 'Accepted',
      statusMessage: `Great news! <strong>${shopName}</strong> has accepted your guest spot request. You can view the booking and complete the deposit when ready.`,
    };
  }
  return {
    statusLabel: 'Rejected',
    statusMessage: `Unfortunately, <strong>${shopName}</strong> is unable to accept your guest spot request at this time.`,
  };
};

const buildRejectNoteSection = (rejectNote?: string | null): string => {
  if (!rejectNote || !rejectNote.trim()) {
    return '';
  }
  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">
                  <tr>
                    <td style="font-size:16px;font-weight:600;color:#ffffff;padding-bottom:12px;">Shop's Note</td>
                  </tr>
                  <tr>
                    <td style="background-color:#151515;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;font-size:15px;line-height:1.6;color:#e0e0e0;">
                      ${escapeHtml(rejectNote.trim())}
                    </td>
                  </tr>
                </table>`;
};

const buildGuestSpotBookingResponseHtml = async (
  payload: GuestSpotBookingResponseEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadTemplate();
  const shopName = payload.shopName || 'Shop';
  const statusInfo = getStatusInfo(payload.reaction, shopName);
  const rejectNoteSection =
    payload.reaction === 'rejected'
      ? buildRejectNoteSection(payload.rejectNote)
      : '';
  const viewBookingUrl = getViewBookingUrl(payload.bookingDocumentId);
  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());

  const variables: Record<string, string> = {
    shopName: toDisplayValue(shopName),
    status: payload.reaction,
    statusLabel: statusInfo.statusLabel,
    statusMessage: statusInfo.statusMessage,
    selectedDate: formatDateOnly(payload.selectedDate),
    selectedTime: formatTime(payload.selectedTime),
    slotTitle: toDisplayValue(payload.slotTitle, 'Guest spot slot'),
    rejectNoteSection,
    viewBookingUrl: viewBookingUrl ? escapeHtml(viewBookingUrl) : '#',
    hasViewLink: viewBookingUrl ? 'true' : '',
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `Guest spot request ${statusInfo.statusLabel}`,
    `Shop: ${shopName}`,
    `Date: ${formatDateOnly(payload.selectedDate)}`,
    `Time: ${formatTime(payload.selectedTime)}`,
    payload.slotTitle ? `Slot: ${payload.slotTitle}` : '',
  ];
  if (payload.reaction === 'rejected' && payload.rejectNote) {
    textLines.push(`Shop's Note: ${payload.rejectNote}`);
  }
  if (viewBookingUrl) {
    textLines.push(`View booking: ${viewBookingUrl}`);
  }

  return {
    html,
    subject: `Guest spot request ${statusInfo.statusLabel} - ${shopName}`,
    text: textLines.join('\n'),
  };
};

export const sendGuestSpotBookingResponseEmail = async (
  payload: GuestSpotBookingResponseEmailPayload,
): Promise<void> => {
  if (!payload.artistEmail?.trim()) {
    strapi.log.warn(
      '[GuestSpotBookingResponseEmail] Cannot send email without artist email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildGuestSpotBookingResponseHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.artistEmail.trim(),
      from: process.env.EMAIL_FROM,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[GuestSpotBookingResponseEmail] Sent guest spot ${payload.reaction} notification to ${payload.artistEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      '[GuestSpotBookingResponseEmail] Failed to send guest spot booking response notification:',
      error,
    );
  }
};
