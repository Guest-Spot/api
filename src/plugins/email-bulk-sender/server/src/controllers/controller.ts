import type { Core } from '@strapi/strapi';
import * as fs from 'fs';
import * as path from 'path';

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
      const config = strapi.config.get('plugin.email-bulk-sender');
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
      const config = strapi.config.get('plugin.email-bulk-sender');
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
});

export default controller;
