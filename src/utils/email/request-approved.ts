import fs from 'fs/promises';
import path from 'path';

type RequestApprovedEmailPayload = {
  email?: string | null;
  name?: string | null;
  tempPassword?: string | null;
  username?: string | null;
  type?: string | null;
};

const REQUEST_APPROVED_TEMPLATE_NAME = 'request-approved.html';

const APPLICATION_TYPE_LABELS: Record<string, string> = {
  shop: 'Shop',
  artist: 'Artist',
};

let cachedRequestApprovedTemplate: string | null = null;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getApplicationTypeLabel = (type?: string | null): string => {
  if (!type) {
    return 'Shop';
  }

  return APPLICATION_TYPE_LABELS[type] ?? type;
};

const getAppUrl = (): string => {
  const envUrl =
    process.env.FRONTEND_AUTH_URL ||
    'https://getguestspot.app/#/sign-in';

  if (envUrl && envUrl.trim()) {
    return envUrl.replace(/\/$/, '');
  }

  const serverUrl = strapi.config.get('server.url');

  if (serverUrl && typeof serverUrl === 'string') {
    return serverUrl.replace(/\/$/, '');
  }

  return '#';
};

const getSupportEmail = (): string =>
  process.env.SUPPORT_EMAIL ||
  process.env.EMAIL_REPLY_TO ||
  process.env.EMAIL_FROM ||
  'GuestSpot Support <support@getguestspot.com>';

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src', 'utils', 'email', REQUEST_APPROVED_TEMPLATE_NAME);

const loadRequestApprovedTemplate = async (): Promise<string> => {
  if (cachedRequestApprovedTemplate) {
    return cachedRequestApprovedTemplate;
  }

  const templatePath = getTemplatePath();
  cachedRequestApprovedTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedRequestApprovedTemplate;
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

const buildRequestApprovedEmail = async (
  payload: RequestApprovedEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadRequestApprovedTemplate();

  const applicationType = (payload.type ?? 'shop').toLowerCase();
  const applicationTypeLabel = getApplicationTypeLabel(applicationType);
  const name = payload.name?.trim() || 'GuestSpot User';
  const email = payload.email?.trim() || 'No email provided';
  const username = payload.username?.trim();
  const tempPassword = payload.tempPassword?.trim() || 'Set via support';
  const appUrl = getAppUrl();
  const supportEmail = getSupportEmail();
  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());

  const variables: Record<string, string> = {
    applicationTypeLabel: escapeHtml(applicationTypeLabel),
    name: escapeHtml(name),
    login: escapeHtml(username || email),
    tempPassword: escapeHtml(tempPassword),
    appUrl: escapeHtml(appUrl),
    supportEmail: escapeHtml(supportEmail),
    currentYear: escapeHtml(currentYear),
  };

  const html = renderTemplate(template, variables);

  const textLines = [
    `Welcome to GuestSpot, ${name}!`,
    `Your ${applicationTypeLabel} application has been approved.`,
    `Login: ${ username || email}`,
    `Temporary password: ${tempPassword}`,
    `App URL: ${appUrl}`,
    `Support: ${supportEmail}`,
  ];

  return {
    html,
    subject: `Your GuestSpot ${applicationTypeLabel} account is ready`,
    text: textLines.join('\n'),
  };
};

export const sendRequestApprovedEmail = async (
  payload: RequestApprovedEmailPayload,
): Promise<void> => {
  if (!payload.email) {
    strapi.log.warn(
      '[RequestApprovedEmail] Cannot send email without recipient address.',
    );
    return;
  }

  const { html, subject, text } = await buildRequestApprovedEmail(payload);

  await strapi.plugins.email.services.email.send({
    to: payload.email,
    from: process.env.EMAIL_FROM,
    subject,
    html,
    text,
  });
};
