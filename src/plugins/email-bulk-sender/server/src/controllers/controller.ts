import type { Core } from '@strapi/strapi';
import * as fs from 'fs';
import * as path from 'path';

interface EmailBulkSenderConfig {
  emailTemplate?: {
    enabled?: boolean;
    path?: string;
  };
}

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('email-bulk-sender')
      // the name of the service file & the method.
      .service('service')
      .getWelcomeMessage();
  },

  async getTemplates(ctx) {
    try {
      const config = strapi.config.get('plugin.email-bulk-sender') as EmailBulkSenderConfig;
      const templatePath = config?.emailTemplate?.path || 'templates';
      const fullPath = path.resolve(process.cwd(), templatePath);

      if (!fs.existsSync(fullPath)) {
        ctx.body = { templates: [] };
        return;
      }

      const files = fs.readdirSync(fullPath);
      const templates = files
        .filter(file => file.endsWith('.html'))
        .map(file => ({
          name: path.basename(file, '.html'),
          path: path.join(templatePath, file),
          filename: file
        }));

      ctx.body = { templates };
    } catch (error) {
      strapi.log.error('Error getting templates:', error);
      ctx.status = 500;
      ctx.body = { error: 'Failed to get templates' };
    }
  },

  async getTemplateContent(ctx) {
    try {
      const { templatePath } = ctx.params;
      const config = strapi.config.get('plugin.email-bulk-sender') as EmailBulkSenderConfig;
      const basePath = config?.emailTemplate?.path || 'templates';
      const fullPath = path.resolve(process.cwd(), basePath, templatePath);

      // Security check: ensure the path is within the templates directory
      const resolvedBasePath = path.resolve(process.cwd(), basePath);
      if (!fullPath.startsWith(resolvedBasePath)) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid template path' };
        return;
      }

      if (!fs.existsSync(fullPath)) {
        ctx.status = 404;
        ctx.body = { error: 'Template not found' };
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      ctx.body = { content };
    } catch (error) {
      strapi.log.error('Error getting template content:', error);
      ctx.status = 500;
      ctx.body = { error: 'Failed to get template content' };
    }
  },

  async sendBulkEmails(ctx) {
    try {
      const { template, documents } = ctx.request.body;

      if (!template || !documents || !Array.isArray(documents)) {
        ctx.status = 400;
        ctx.body = { error: 'Template and documents array are required' };
        return;
      }

      // Get template content
      const config = strapi.config.get('plugin.email-bulk-sender') as EmailBulkSenderConfig;
      const basePath = config?.emailTemplate?.path || 'templates';
      const templatePath = path.resolve(process.cwd(), basePath, `${template}.html`);

      if (!fs.existsSync(templatePath)) {
        ctx.status = 404;
        ctx.body = { error: 'Template not found' };
        return;
      }

      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const results = [];

      // Send emails to each document
      for (const document of documents) {
        try {
          // Render template with document data
          let renderedContent = templateContent;
          if (document.email) {
            renderedContent = renderedContent.replace(/\{\{\s*email\s*\}\}/g, document.email);
          }
          if (document.name) {
            renderedContent = renderedContent.replace(/\{\{\s*name\s*\}\}/g, document.name);
          }

          // Send email using Strapi email plugin
          await strapi.plugins.email.services.email.send({
            to: document.email,
            subject: `GuestSpot - ${template.charAt(0).toUpperCase() + template.slice(1)}`,
            html: renderedContent,
          });

          results.push({
            id: document.id,
            email: document.email,
            status: 'sent',
            success: true
          });

          strapi.log.info(`Email sent successfully to ${document.email}`);
        } catch (emailError) {
          strapi.log.error(`Failed to send email to ${document.email}:`, emailError);
          results.push({
            id: document.id,
            email: document.email,
            status: 'failed',
            success: false,
            error: emailError.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      ctx.body = {
        success: true,
        message: `Bulk email sending completed. ${successCount} sent, ${failureCount} failed.`,
        results,
        summary: {
          total: documents.length,
          sent: successCount,
          failed: failureCount
        }
      };

    } catch (error) {
      strapi.log.error('Error sending bulk emails:', error);
      ctx.status = 500;
      ctx.body = { error: 'Failed to send bulk emails' };
    }
  },
});

export default controller;
