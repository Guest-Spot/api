import React from 'react';
import { Box, Typography } from '@strapi/design-system';

interface DocumentItemProps {
  document: any;
  index: number;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ document, index }) => {
  return React.createElement(
    Box,
    {
      key: document.id || index,
      padding: 2,
      background: 'neutral0',
      borderRadius: '4px',
      marginBottom: 1
    },
    React.createElement(
      Typography,
      { variant: 'pi', textColor: 'neutral700' },
      `ID: ${document.id} - ${document.name || document.title || document.email || 'No name'}`
    )
  );
};

export default DocumentItem;
