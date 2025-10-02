# Email Bulk Sender Plugin

A Strapi plugin that allows sending bulk email campaigns using HTML templates.

## Description

Email Bulk Sender is a Strapi v5 plugin that provides functionality for mass sending personalized email messages. The plugin includes:

- **Administrative interface** for selecting recipients and templates
- **Template system** with variable support
- **Bulk sending** with result tracking
- **Security** with template path validation

## Features

- 📧 Bulk email sending
- 🎨 HTML template support with variables
- 👥 Recipient selection from various collections
- 📊 Send result tracking
- 🔒 Secure template file handling
- 🎯 Message personalization

## Installation

1. Ensure the plugin is located in the `src/plugins/email-bulk-sender/` folder
2. The plugin is automatically loaded by Strapi on startup

## Configuration

### Plugin Configuration

Add configuration to the `config/plugins.ts` file:

```typescript
export default {
  // ... other plugins
  'email-bulk-sender': {
    enabled: true,
    resolve: './src/plugins/email-bulk-sender'
  },
  // ... other settings
}
```

### Email Service Configuration

Ensure that an email provider is configured in Strapi. Add configuration to `config/plugins.ts`:

```typescript
export default {
  // ... other plugins
  email: {
    config: {
      provider: 'nodemailer', // or another provider
      providerOptions: {
        // provider settings
      },
      settings: {
        defaultFrom: 'noreply@yourdomain.com',
        defaultReplyTo: 'noreply@yourdomain.com',
      },
    },
  },
  // ... other settings
}
```

### Template Path Configuration

By default, the plugin looks for templates in the `templates/` folder in the project root. You can change this in the configuration:

```typescript
export default {
  // ... other plugins
  'email-bulk-sender': {
    enabled: true,
    resolve: './src/plugins/email-bulk-sender',
    config: {
      emailTemplate: {
        enabled: true,
        path: 'templates' // path to templates folder
      }
    }
  },
  // ... other settings
}
```

## Usage

### Creating Templates

1. Create HTML files in the `templates/` folder
2. Use variables in the format `{{variableName}}`
3. Available variables:
   - `{{email}}` - recipient's email
   - `{{name}}` - recipient's name

Example template (`templates/welcome.html`):

```html
<!DOCTYPE html>
<html>
<head>
    <title>Welcome</title>
</head>
<body>
    <h1>Hello {{name}}!</h1>
    <p>Your email: {{email}}</p>
    <p>Welcome to our platform!</p>
</body>
</html>
```

### Sending via Administrative Interface

1. Go to the Strapi admin panel
2. Open the list of users in Content Manager 
3. Select recipients from available users using checkboxes
4. The “Send email” button will appear. Click it.
5. Choose a template for sending
6. Click "Send emails"

### API Endpoints

#### Get Templates List
```
GET /api/email-bulk-sender/templates
```

#### Get Template Content
```
GET /api/email-bulk-sender/templates/:templatePath
```

#### Send Bulk Emails
```
POST /api/email-bulk-sender/send-bulk-emails
```

Request body:
```json
{
  "template": "welcome",
  "documents": [
    {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe"
    }
  ]
}
```

## Project Structure

```
src/plugins/email-bulk-sender/
├── admin/                 # Administrative interface
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Admin pages
│   │   └── utils/         # Utilities
├── server/                # Server-side
│   ├── src/
│   │   ├── controllers/   # API controllers
│   │   ├── routes/        # Routes
│   │   ├── services/      # Services
│   │   └── config/        # Configuration
├── package.json
└── README.md
```

## Development

### Building the Plugin

```bash
npm run build
```

### Development Mode

```bash
npm run watch
```

### TypeScript Check

```bash
npm run test:ts:front  # for admin
npm run test:ts:back   # for server
```

## Requirements

- Strapi v5.23.3
- Node.js 18+
- Configured email provider in Strapi

## License

MIT License

## Author

denisgrushkin <denis.grushkin@maddevs.io>
