import fs from 'fs/promises';
import path from 'path';

const CLAIM_PROFILE_TEMPLATE_NAME = 'claim-profile-template.html';

export type ClaimProfileEmailPayload = {
  email: string;
  code: string;
  url: string;
};

let cachedClaimProfileTemplate: string | null = null;

const getTemplatePath = (): string =>
  path.join(strapi.dirs.app.root, 'src/utils/email', CLAIM_PROFILE_TEMPLATE_NAME);

const loadClaimProfileTemplate = async (): Promise<string> => {
  if (cachedClaimProfileTemplate) {
    return cachedClaimProfileTemplate;
  }

  const templatePath = getTemplatePath();
  cachedClaimProfileTemplate = await fs.readFile(templatePath, 'utf-8');

  return cachedClaimProfileTemplate;
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

const buildClaimProfileHtml = async (
  payload: ClaimProfileEmailPayload,
): Promise<{ html: string; subject: string; text: string }> => {
  const template = await loadClaimProfileTemplate();

  const currentYear = new Date().getFullYear().toString();

  const variables: Record<string, string> = {
    url: payload.url,
    code: payload.code,
    currentYear,
  };

  const html = renderTemplate(template, variables);

  const text = `
    GuestSpot - Profile Access
    Claim your profile
    
    You requested to claim a GuestSpot profile. Since you received this email, you can reset the password for this account to verify ownership and gain access.
    
    Set new password: ${payload.url}?code=${payload.code}
    
    If you did not request to claim this profile, you can safely ignore this email.
    
    (c) ${currentYear} GuestSpot. All rights reserved.
  `;

  return {
    html,
    subject: 'Access Your Profile - GuestSpot',
    text,
  };
};

export const sendClaimProfileEmail = async (
  payload: ClaimProfileEmailPayload,
): Promise<void> => {
  if (!payload.email) {
    strapi.log.warn(
      '[ClaimProfileEmail] Cannot send email without email address.',
    );
    return;
  }

  try {
    const { html, subject, text } = await buildClaimProfileHtml(payload);

    await strapi.plugins.email.services.email.send({
      to: payload.email,
      subject,
      html,
      text,
    });

    strapi.log.info(
      `[ClaimProfileEmail] Sent claim profile email to ${payload.email}`,
    );
  } catch (error) {
    strapi.log.error(
      `[ClaimProfileEmail] Failed to send claim profile email:`,
      error,
    );
  }
};
