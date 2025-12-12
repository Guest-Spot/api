import fs from 'fs/promises';
import path from 'path';

const MEMBERSHIP_REQUEST_TEMPLATE_NAME = 'membership-request.html';

const APPLICATION_TYPE_LABELS: Record<string, string> = {
  shop: 'Shop',
  artist: 'Artist',
};

export type MembershipRequestEmailPayload = {
  address?: string | null;
  city?: string | null;
  contactName?: string | null;
  description?: string | null;
  documentId?: string | null;
  email?: string | null;
  experience?: number | string | null;
  link?: string | null;
  name?: string | null;
  phone?: string | null;
  type?: string | null;
};

let cachedMembershipRequestTemplate: string | null = null;

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

const getApplicationTypeLabel = (type?: string | null): string => {
  if (!type) {
    return 'Shop';
  }

  return APPLICATION_TYPE_LABELS[type] ?? type;
};

const getAdminBaseUrl = (): string => {
  const envUrl =
    process.env.MEMBERSHIP_REQUEST_REVIEW_BASE_URL ||
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

const buildReviewUrl = (documentId?: string | null): string => {
  const baseUrl = getAdminBaseUrl();

  if (!baseUrl) {
    return '#';
  }

  const collectionPath =
    '/admin/content-manager/collection-types/api::membership-request.membership-request';

  return documentId
    ? `${baseUrl}${collectionPath}/${documentId}`
    : `${baseUrl}${collectionPath}`;
};

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src/utils/email', MEMBERSHIP_REQUEST_TEMPLATE_NAME);

const loadMembershipRequestTemplate = async (): Promise<string> => {
  if (cachedMembershipRequestTemplate) {
    return cachedMembershipRequestTemplate;
  }

  const templatePath = getTemplatePath();
  cachedMembershipRequestTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedMembershipRequestTemplate;
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

const buildMembershipRequestHtml = async (
  payload: MembershipRequestEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadMembershipRequestTemplate();

  const applicationType = (payload.type ?? 'shop').toLowerCase();
  const applicationTypeLabel = getApplicationTypeLabel(applicationType);
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
    applicationType: escapeHtml(applicationType),
    applicationTypeLabel: escapeHtml(applicationTypeLabel),
    name: toDisplayValue(payload.name, 'Unknown applicant'),
    contactName: toDisplayValue(payload.contactName),
    email: toDisplayValue(payload.email, 'No email provided'),
    phone: toDisplayValue(payload.phone),
    city: toDisplayValue(payload.city, 'Not specified'),
    address: toDisplayValue(payload.address),
    experience: toDisplayValue(payload.experience ?? '0', '0'),
    link: toDisplayValue(payload.link),
    description: toDisplayValue(
      payload.description,
      'No additional details were provided.',
    ),
    submittedAt: escapeHtml(submittedAt),
    reviewUrl: escapeHtml(buildReviewUrl(payload.documentId)),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `New ${applicationTypeLabel} application received`,
    `Applicant: ${payload.name ?? 'Unknown applicant'}`,
    `Contact: ${payload.contactName ?? 'Not provided'}`,
    `Email: ${payload.email ?? 'Not provided'}`,
    `Phone: ${payload.phone ?? 'Not provided'}`,
    `City: ${payload.city ?? 'Not provided'}`,
    `Experience: ${payload.experience ?? '0'} years`,
    `Portfolio: ${payload.link ?? 'Not provided'}`,
    `Submitted: ${submittedAt}`,
    `Review: ${buildReviewUrl(payload.documentId)}`,
  ];

  return {
    html,
    subject: `New ${applicationTypeLabel} application`,
    text: textLines.join('\n'),
  };
};

export const sendMembershipRequestEmail = async (
  payload: MembershipRequestEmailPayload,
): Promise<void> => {
  const { html, subject, text } = await buildMembershipRequestHtml(payload);

  await strapi.plugins.email.services.email.send({
    to: process.env.EMAIL_REPLY_TO,
    subject,
    html,
    text,
  });
};
