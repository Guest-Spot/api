import React from 'react';
import { Box, Typography, Table, Thead, Tbody, Tr, Th, Td, Button } from '@strapi/design-system';
import { Trash } from '@strapi/icons';

interface DocumentListProps {
  documents: any[];
  onRemoveDocument?: (documentId: string | number) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ documents, onRemoveDocument }) => {
  return React.createElement(
    Box,
    { padding: 3, background: 'neutral100', borderRadius: '4px' },
    React.createElement(
      Typography,
      { variant: 'beta', textColor: 'neutral800' },
      `Selected documents: ${documents.length}`
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
