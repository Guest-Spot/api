import React from 'react';
import { Button, Box, Typography, Alert, SingleSelect, SingleSelectOption } from '@strapi/design-system';
import DocumentList from './DocumentList';
import { useEmailSender, useTemplates, Template } from '../utils/templateUtils';

interface TemplatePickerProps {
  onClose: () => void;
  documents: any[];
}

// Template Selector Component
interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateChange: (template: string) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ selectedTemplate, onTemplateChange }) => {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { getTemplates } = useTemplates();

  React.useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templateList = await getTemplates();
        setTemplates(templateList);
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [getTemplates]);

  const handleTemplateChange = (value: string) => {
    onTemplateChange(value);
  };

  return React.createElement(
    Box,
    { marginBottom: 3 },
    React.createElement(
      Typography,
      { variant: 'beta', textColor: 'neutral700', marginBottom: 4, },
      'Email Template:'
    ),
    loading ? React.createElement(
      Typography,
      { variant: 'pi', textColor: 'neutral500' },
      'Loading templates...'
    ) : templates.length > 0 ? React.createElement(
      SingleSelect,
      {
        value: selectedTemplate,
        onChange: handleTemplateChange,
        placeholder: 'Select a template'
      },
      templates.map(template =>
        React.createElement(
          SingleSelectOption,
          { key: template.name, value: template.name },
          template.name
        )
      )
    ) : React.createElement(
      Typography,
      { variant: 'pi', textColor: 'neutral500' },
      'No templates found'
    )
  );
};

const TemplatePicker: React.FC<TemplatePickerProps> = ({ onClose, documents }) => {
  const [template, setTemplate] = React.useState<string>('');
  const [documentsList, setDocumentsList] = React.useState(documents);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const { sendBulkEmails } = useEmailSender();

  const handleRemoveDocument = (documentId: string | number) => {
    setDocumentsList(prev => prev.filter(doc => doc.id !== documentId));
  };

  const handleTemplateChange = (selectedTemplate: string) => {
    setTemplate(selectedTemplate);
  };

  const send = async () => {
    if (!template || documentsList.length === 0) {
      setError('Please select a template and at least one document');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await sendBulkEmails(template, documentsList);
      setResult(response);

      if (response.summary.failed > 0) {
        setError(`Some emails failed to send. ${response.summary.sent} sent, ${response.summary.failed} failed.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send emails');
    } finally {
      setIsLoading(false);
    }
  };

  return React.createElement(
    Box,
    { padding: 4 },
    React.createElement(
      Box,
      {},
      // Template Selector
      React.createElement(TemplateSelector, {
        selectedTemplate: template,
        onTemplateChange: handleTemplateChange
      }),

      // Document List
      React.createElement(DocumentList, {
        documents: documentsList,
        onRemoveDocument: handleRemoveDocument
      }),

      // Error display
      error && React.createElement(
        Alert,
        {
          closeLabel: 'Close',
          title: 'Error',
          variant: 'danger',
          onClose: () => setError(null)
        },
        error
      ),

      // Success result display
      result && React.createElement(
        Alert,
        {
          closeLabel: 'Close',
          title: 'Email Sending Results',
          variant: result.summary.failed > 0 ? 'warning' : 'success',
          onClose: () => setResult(null)
        },
        React.createElement(
          Box,
          {},
          React.createElement(Typography, { variant: 'omega' }, result.message),
          React.createElement(
            Box,
            { marginTop: 2 },
            React.createElement(Typography, { variant: 'pi' },
              `Total: ${result.summary.total} | Sent: ${result.summary.sent} | Failed: ${result.summary.failed}`
            )
          )
        )
      ),

      React.createElement(
        Box,
        { marginTop: 3, display: 'flex', gap: 2 },
        React.createElement(
          Button,
          {
            onClick: send,
            disabled: documentsList.length === 0 || !template || isLoading,
            loading: isLoading,
            style: { marginRight: '8px' }
          },
          isLoading ? 'Sending...' :
            !template ? 'Select a template to send emails' :
            `Send ${documentsList.length} email(s) with template: ${template}`
        ),
        React.createElement(
          Button,
          {
            onClick: onClose,
            variant: 'secondary',
            disabled: isLoading
          },
          'Close'
        )
      )
    )
  );
};

export default TemplatePicker;
