import React from 'react';
import { Button, Box } from '@strapi/design-system';

const TemplatePicker: React.FC<{ onClose: () => void; documents: any[] }> = ({ onClose, documents }) => {
  const [template, setTemplate] = React.useState('template1.html');

  const send = async () => {
    console.log('send', template, documents);
    onClose();
  };

  return React.createElement(
    Box,
    { padding: 4 },
    React.createElement(
      Button,
      { onClick: send },
      `Send with ${template}`
    )
  );
};

export default TemplatePicker;
