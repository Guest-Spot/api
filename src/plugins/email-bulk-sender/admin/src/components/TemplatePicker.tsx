import React from 'react';
import { Button, Box } from '@strapi/design-system';
import DocumentList from './DocumentList';

interface TemplatePickerProps {
  onClose: () => void;
  documents: any[];
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({ onClose, documents }) => {
  const [template, setTemplate] = React.useState('template1.html');

  const send = async () => {
    console.log('send', template, documents);
    onClose();
  };

  return React.createElement(
    Box,
    { padding: 4 },
    React.createElement(
      Box,
      {},
      React.createElement(DocumentList, { documents }),
      React.createElement(
        Box,
        { marginTop: 3 },
        React.createElement(
          Button,
          { onClick: send },
          `Send with ${template}`
        )
      )
    )
  );
};

export default TemplatePicker;
