import React from 'react';
import { Button, Box, Typography } from '@strapi/design-system';

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
      Box,
      {},
      React.createElement(
        Box,
        { padding: 3, background: 'neutral100', borderRadius: '4px' },
        React.createElement(
          Typography,
          { variant: 'beta', textColor: 'neutral800' },
          `Selected documents: ${documents.length}`
        ),
        documents.length > 0 && React.createElement(
          Box,
          { marginTop: 2 },
          React.createElement(
            Box,
            { marginTop: 1, maxHeight: '200px', overflow: 'auto' },
            documents.map((doc, index) =>
              React.createElement(
                Box,
                {
                  key: doc.id || index,
                  padding: 2,
                  background: 'neutral0',
                  borderRadius: '4px',
                  marginBottom: 1
                },
                React.createElement(
                  Typography,
                  { variant: 'pi', textColor: 'neutral700' },
                  `ID: ${doc.id} - ${doc.name || doc.title || doc.email || 'No name'}`
                )
              )
            )
          )
        )
      ),
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
