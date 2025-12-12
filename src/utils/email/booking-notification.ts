import fs from 'fs/promises';
import path from 'path';
import { formatDateOnly } from '../date';

const BOOKING_NOTIFICATION_TEMPLATE_NAME = 'booking-notification.html';

export type BookingNotificationEmailPayload = {
  artistName?: string | null;
  artistEmail?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  location?: string | null;
  placement?: string | null;
  size?: string | null;
  description?: string | null;
  day?: string | null;
  start?: string | null;
  documentId?: string | null;
};

let cachedBookingNotificationTemplate: string | null = null;

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
  path.join(strapi.dirs.app.root, 'src/utils/email', BOOKING_NOTIFICATION_TEMPLATE_NAME);

const loadBookingNotificationTemplate = async (): Promise<string> => {
  if (cachedBookingNotificationTemplate) {
    return cachedBookingNotificationTemplate;
  }

  const templatePath = getTemplatePath();
  cachedBookingNotificationTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedBookingNotificationTemplate;
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

const buildBookingNotificationHtml = async (
  payload: BookingNotificationEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadBookingNotificationTemplate();

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

  const variables: Record<string, string> = {
    artistName: toDisplayValue(payload.artistName, 'Artist'),
    guestName: toDisplayValue(payload.guestName, 'Guest'),
    guestEmail: toDisplayValue(payload.guestEmail, 'No email provided'),
    guestPhone: toDisplayValue(payload.guestPhone),
    location: toDisplayValue(payload.location, 'Not specified'),
    description: toDisplayValue(
      payload.description,
      'No description provided',
    ),
    placement: toDisplayValue(payload.placement, 'Not specified'),
    size: toDisplayValue(payload.size, 'Not specified'),
    day: formatDate(payload.day),
    start: formatTime(payload.start),
    submittedAt: escapeHtml(submittedAt),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `New booking request received`,
    `Artist: ${payload.artistName ?? 'Artist'}`,
    `Guest: ${payload.guestName ?? 'Guest'}`,
    `Email: ${payload.guestEmail ?? 'Not provided'}`,
    `Phone: ${payload.guestPhone ?? 'Not provided'}`,
    `Location: ${payload.location ?? 'Not specified'}`,
    `Day: ${formatDate(payload.day)}`,
    `Start: ${formatTime(payload.start)}`,
    `Idea Description: ${payload.description ?? 'No description provided'}`,
    `Placement: ${payload.placement ?? 'Not specified'}`,
    `Size: ${payload.size ?? 'Not specified'}`,
    `Submitted: ${submittedAt}`,
  ];

  return {
    html,
    subject: `New booking request from ${payload.guestName ?? 'a guest'}`,
    text: textLines.join('\n'),
  };
};

export const sendBookingNotificationEmail = async (
  payload: BookingNotificationEmailPayload,
): Promise<void> => {
  if (!payload.artistEmail) {
    strapi.log.warn(
      '[BookingNotificationEmail] Cannot send email without artist email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildBookingNotificationHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.artistEmail,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[BookingNotificationEmail] Sent booking notification to ${payload.artistEmail}`,
    );
  } catch (error) {
    strapi.log.error(
      `[BookingNotificationEmail] Failed to send booking notification:`,
      error,
    );
  }
};
