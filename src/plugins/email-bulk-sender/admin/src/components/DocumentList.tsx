import React from 'react';
import { Box, Typography, Table, Thead, Tbody, Tr, Th, Td, Button, SingleSelect, SingleSelectOption } from '@strapi/design-system';
import { useTemplates, Template } from '../utils/templateUtils';

interface DocumentListProps {
  documents: any[];
  onRemoveDocument?: (documentId: string | number) => void;
  onTemplateChange?: (template: string) => void;
  selectedTemplate?: string;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onRemoveDocument,
  onTemplateChange,
  selectedTemplate
}) => {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { getTemplates } = useTemplates();

  React.useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templateList = await getTemplates();
        setTemplates(templateList);
        if (templateList.length > 0 && !selectedTemplate) {
          onTemplateChange?.(templateList[0].name);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [getTemplates, onTemplateChange, selectedTemplate]);

  const handleTemplateChange = (value: string) => {
    onTemplateChange?.(value);
  };

  return React.createElement(
    Box,
    { padding: 3, background: 'neutral100', borderRadius: '4px' },
    React.createElement(
      Typography,
      { variant: 'beta', textColor: 'neutral800' },
      `Selected documents: ${documents.length}`
    ),
    React.createElement(
      Box,
      { marginTop: 3 },
      React.createElement(
        Typography,
        { variant: 'pi', textColor: 'neutral700', marginBottom: 4 },
        'Email Template:'
      ),
      loading ? React.createElement(
        Typography,
        { variant: 'pi', textColor: 'neutral500' },
        'Loading templates...'
      ) : templates.length > 0 ? React.createElement(
        SingleSelect,
        {
          value: selectedTemplate || templates[0]?.name || '',
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
    ),
    documents.length > 0 && React.createElement(
      Box,
      { marginTop: 2, overflow: 'auto', maxHeight: '600px' },
      React.createElement(
        Table,
        { overflow: 'auto' },
        React.createElement(
          Thead,
          {},
          React.createElement(
            Tr,
            {},
            React.createElement(Th, {}, 'ID'),
            React.createElement(Th, {}, 'Name'),
            React.createElement(Th, {}, 'Email'),
            React.createElement(Th, {
              align: 'right'
            }, '')
          )
        ),
        React.createElement(
          Tbody,
          {},
          documents.map((doc, index) =>
            React.createElement(
              Tr,
              { key: doc.id || index },
              React.createElement(
                Td,
                {},
                React.createElement(
                  Typography,
                  { variant: 'pi', textColor: 'neutral700' },
                  doc.id || index
                )
              ),
              React.createElement(
                Td,
                {},
                React.createElement(
                  Typography,
                  { variant: 'pi', textColor: 'neutral700' },
                  doc.name || doc.title || 'No name'
                )
              ),
              React.createElement(
                Td,
                {},
                doc.email ? React.createElement(
                  Typography,
                  { variant: 'pi', textColor: 'primary600' },
                  doc.email
                ) : React.createElement(
                  Typography,
                  { variant: 'pi', textColor: 'neutral500' },
                  'No email'
                )
              ),
              React.createElement(
                Td,
                {
                  style: {
                    textAlign: 'right'
                  }
                },
                React.createElement(
                  Button,
                  {
                    variant: 'danger-light',
                    onClick: () => onRemoveDocument?.(doc.id || index),
                    size: 'S',
                  },
                  'Remove'
                )
              )
            )
          )
        )
      )
    )
  );
};

export default DocumentList;
