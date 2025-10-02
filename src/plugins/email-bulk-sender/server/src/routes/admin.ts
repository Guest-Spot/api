export default [
  {
    method: 'GET',
    path: '/templates',
    handler: 'controller.getTemplates',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/templates/:templatePath',
    handler: 'controller.getTemplateContent',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/send-bulk-emails',
    handler: 'controller.sendBulkEmails',
    config: {
      policies: [],
    },
  },
];
