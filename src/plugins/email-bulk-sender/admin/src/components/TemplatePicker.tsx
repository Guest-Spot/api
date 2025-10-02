import React from 'react';
import { Button, Box } from '@strapi/design-system';
import DocumentList from './DocumentList';

interface TemplatePickerProps {
  onClose: () => void;
  documents: any[];
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({ onClose, documents }) => {
  const [template, setTemplate] = React.useState('template1.html');
  const [documentsList, setDocumentsList] = React.useState(documents);

  const handleRemoveDocument = (documentId: string | number) => {
    setDocumentsList(prev => prev.filter(doc => doc.id !== documentId));
  };

  const send = async () => {
    console.log('send', template, documentsList);
    onClose();
  };

  return React.createElement(
    Box,
    { padding: 4 },
    React.createElement(
      Box,
      {},
      React.createElement(DocumentList, {
        documents: documentsList,
        onRemoveDocument: handleRemoveDocument
      }),
      React.createElement(
        Box,
        { marginTop: 3 },
        React.createElement(
          Button,
          { onClick: send, disabled: documentsList.length === 0 },
          `Send with ${template}`
        )
      )
    )
  );
};

export default TemplatePicker;
