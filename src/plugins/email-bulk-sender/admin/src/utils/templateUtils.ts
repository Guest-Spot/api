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
    } catch (error: any) {
      console.error('Error fetching templates:', error);

      // Handle different types of errors
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          console.warn('Templates endpoint not found - plugin may not be properly configured');
        } else if (status >= 500) {
          console.error(`Server error while fetching templates: ${status}`);
        }
      }

      return [];
    }
  };

  const getTemplateContent = async (templatePath: string): Promise<string> => {
    try {
      const response = await get(`/email-bulk-sender/templates/${encodeURIComponent(templatePath)}`);
      return response.data.content || '';
    } catch (error: any) {
      console.error('Error fetching template content:', error);

      // Handle different types of errors
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          console.warn(`Template not found: ${templatePath}`);
        } else if (status >= 500) {
          console.error(`Server error while fetching template content: ${status}`);
        }
      }

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

export const useEmailSender = () => {
  const { post } = useFetchClient();

  const sendBulkEmails = async (template: string, documents: any[]): Promise<{
    success: boolean;
    message: string;
    results: any[];
    summary: {
      total: number;
      sent: number;
      failed: number;
    };
  }> => {
    try {
      const response = await post('/email-bulk-sender/send-bulk-emails', {
        template,
        documents
      });
      return response.data;
    } catch (error: any) {
      console.error('Error sending bulk emails:', error);

      // Handle different types of errors - more robust approach
      let errorMessage = 'Unknown error occurred';
      let status = null;

      // Check if it's a response error (axios-like)
      if (error.response) {
        status = error.response.status;
        const statusText = error.response.statusText;

        if (status === 405) {
          errorMessage = 'Method Not Allowed - API endpoint may not be properly configured';
        } else if (status === 404) {
          errorMessage = 'API endpoint not found - check if the plugin is properly installed';
        } else if (status >= 500) {
          errorMessage = `Server error (${status}): ${statusText}`;
        } else {
          // Try to get error message from response data
          const responseError = error.response.data?.error || error.response.data?.message || statusText;
          errorMessage = `Request failed (${status}): ${responseError}`;
        }
      }
      // Check if it's a network error
      else if (error.request) {
        errorMessage = 'Network error - unable to reach the server';
      }
      // Check if it's a parsing error (like JSON parsing)
      else if (error.message && error.message.includes('Unexpected token')) {
        if (error.message.includes('Method Not Allowed')) {
          errorMessage = 'Method Not Allowed - API endpoint may not be properly configured';
        } else {
          errorMessage = `Parsing error: ${error.message}`;
        }
      }
      // Check if it's a Strapi-specific error
      else if (error.message) {
        errorMessage = error.message;
      }
      // Check for other error properties
      else if (error.error) {
        errorMessage = error.error;
      }

      throw new Error(errorMessage);
    }
  };

  return {
    sendBulkEmails,
  };
};
