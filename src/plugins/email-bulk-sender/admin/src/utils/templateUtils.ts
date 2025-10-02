import { useFetchClient } from '@strapi/admin/strapi-admin';

export interface Template {
  name: string;
  path: string;
  content?: string;
}

export const useTemplates = () => {
  const { get } = useFetchClient();

  const getTemplates = async (): Promise<Template[]> => {
    try {
      const response = await get('/email-bulk-sender/templates');
      return response.data.templates || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  };

  const getTemplateContent = async (templatePath: string): Promise<string> => {
    try {
      const response = await get(`/email-bulk-sender/templates/${encodeURIComponent(templatePath)}`);
      return response.data.content || '';
    } catch (error) {
      console.error('Error fetching template content:', error);
      return '';
    }
  };

  return {
    getTemplates,
    getTemplateContent,
  };
};

export const renderTemplate = (template: string, data: Record<string, any>): string => {
  let rendered = template;

  // Replace placeholders like {{name}}, {{email}}, etc.
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, data[key] || '');
  });

  return rendered;
};
