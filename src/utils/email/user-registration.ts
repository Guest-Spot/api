import fs from 'fs/promises';
import path from 'path';

const USER_REGISTRATION_TEMPLATE_NAME = 'user-registration.html';

const USER_TYPE_LABELS: Record<string, string> = {
  shop: 'Shop',
  artist: 'Artist',
  guest: 'Guest',
};

export type UserRegistrationEmailPayload = {
  id?: number | string | null;
  email?: string | null;
  type?: string | null;
  name?: string | null;
  phone?: string | null;
  documentId?: number | string | null;
  createdAt?: string | Date | null;
};

let cachedUserRegistrationTemplate: string | null = null;

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

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return escapeHtml(String(value));
};

const getUserTypeLabel = (type?: string | null): string => {
  if (!type) {
    return 'Guest';
  }

  return USER_TYPE_LABELS[type] ?? type;
};

const getAdminBaseUrl = (): string => {
  const envUrl =
    process.env.ADMIN_BASE_URL ||
    process.env.STRAPI_ADMIN_BASE_URL ||
    process.env.SERVER_URL;

  if (envUrl && envUrl.trim()) {
    return envUrl.replace(/\/$/, '');
  }

  const serverUrl = strapi.config.get('server.url');

  if (serverUrl && typeof serverUrl === 'string') {
    return serverUrl.replace(/\/$/, '');
  }

  return '';
};

const buildReviewUrl = (userId?: number | string | null): string => {
  const baseUrl = getAdminBaseUrl();

  if (!baseUrl) {
    return '#';
  }

  const collectionPath =
    '/admin/content-manager/collection-types/plugin::users-permissions.user';

  return userId
    ? `${baseUrl}${collectionPath}/${userId}`
    : `${baseUrl}${collectionPath}`;
};

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src/utils/email', USER_REGISTRATION_TEMPLATE_NAME);

const loadUserRegistrationTemplate = async (): Promise<string> => {
  if (cachedUserRegistrationTemplate) {
    return cachedUserRegistrationTemplate;
  }

  const templatePath = getTemplatePath();
  cachedUserRegistrationTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedUserRegistrationTemplate;
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

const buildUserRegistrationEmail = async (
  payload: UserRegistrationEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadUserRegistrationTemplate();

  const type = (payload.type ?? 'guest').toLowerCase();
  const typeLabel = getUserTypeLabel(type);
  
  // Format createdAt date
  const createdAtDate = payload.createdAt 
    ? (typeof payload.createdAt === 'string' ? new Date(payload.createdAt) : payload.createdAt)
    : new Date();
  
  const createdAt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(createdAtDate);
  
  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());

  const variables: Record<string, string> = {
    email: toDisplayValue(payload.email, 'No email provided'),
    type: escapeHtml(type),
    typeLabel: escapeHtml(typeLabel),
    name: toDisplayValue(payload.name),
    phone: toDisplayValue(payload.phone),
    createdAt: escapeHtml(createdAt),
    reviewUrl: escapeHtml(buildReviewUrl(payload.documentId ?? payload.id)),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `New ${typeLabel} user registration received`,
    `Email: ${payload.email ?? 'Not provided'}`,
    `Type: ${typeLabel}`,
    `Name: ${payload.name ?? 'Not provided'}`,
    `Phone: ${payload.phone ?? 'Not provided'}`,
    `Registered: ${createdAt}`,
    `Review: ${buildReviewUrl(payload.documentId ?? payload.id)}`,
  ];

  return {
    html,
    subject: `New GuestSpot ${typeLabel} user registration`,
    text: textLines.join('\n'),
  };
};

export const sendUserRegistrationEmail = async (
  payload: UserRegistrationEmailPayload,
): Promise<void> => {
  const { html, subject, text } = await buildUserRegistrationEmail(payload);

  await strapi.plugins.email.services.email.send({
    to: process.env.EMAIL_REPLY_TO,
    from: process.env.EMAIL_FROM,
    subject,
    html,
    text,
  });
};
