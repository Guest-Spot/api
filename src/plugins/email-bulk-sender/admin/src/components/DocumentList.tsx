import React from 'react';
import { Box, Typography, Table, Thead, Tbody, Tr, Th, Td } from '@strapi/design-system';

interface DocumentListProps {
  documents: any[];
}

const DocumentList: React.FC<DocumentListProps> = ({ documents }) => {
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
      { marginTop: 2 },
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
            React.createElement(Th, {}, 'Email')
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
              )
            )
          )
        )
      )
    )
  );
};

export default DocumentList;
