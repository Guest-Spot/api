# Email Templates

This directory contains HTML email templates for the email-bulk-sender plugin.

## Template Structure

Each template should be an HTML file with the following features:

- **File naming**: Use descriptive names ending with `.html` (e.g., `welcome.html`, `notification.html`)
- **Template variables**: Use double curly braces for placeholders (e.g., `{{name}}`, `{{email}}`)
- **Responsive design**: Include CSS for mobile-friendly layouts
- **Inline styles**: Use inline CSS for better email client compatibility

## Available Templates

- `welcome.html` - Welcome email template
- `notification.html` - General notification template  
- `reminder.html` - Reminder email template

## Template Variables

Common variables that can be used in templates:

- `{{name}}` - Recipient's name
- `{{email}}` - Recipient's email address
- `{{id}}` - Document/record ID

## Configuration

The template path is configured in `config/plugins.ts`:

```typescript
'email-bulk-sender': {
  enabled: true,
  resolve: './src/plugins/email-bulk-sender',
  config: {
    emailTemplate: {
      enabled: true,
      path: 'templates', // Path relative to project root
    },
  },
},
```

## Adding New Templates

1. Create a new HTML file in this directory
2. Use the template variable format `{{variableName}}`
3. Include proper HTML structure and inline CSS
4. The template will automatically appear in the admin interface

## Security

- Only `.html` files are loaded as templates
- Template paths are validated to prevent directory traversal attacks
- Templates are read-only from the admin interface
