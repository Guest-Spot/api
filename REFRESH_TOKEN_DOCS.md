# Refresh Token Implementation for Strapi v5

This document describes the implementation of refresh tokens for user authentication in Strapi v5.

## Features

- JWT access tokens with short expiration (15 minutes)
- Refresh tokens with long expiration (30 days)
- Token rotation on refresh
- Support for both REST API and GraphQL
- Secure token storage and validation
- Compatible with Strapi v5 plugin architecture
- Integration with existing users-permissions plugin

## Important Notes for Strapi v5

This implementation has been specifically adapted for Strapi v5 with the following considerations:
- Custom service imports replaced with plugin service calls
- GraphQL mutations renamed to avoid conflicts with built-in mutations
- Pure custom implementation without external refresh token plugins
- Direct environment variable usage for configuration

## Prerequisites

Before using this implementation, ensure you have:

1. **Strapi v5** installed and configured
2. **Required packages** installed:
   ```bash
   npm install jsonwebtoken @types/jsonwebtoken
   npm install lodash @types/lodash
   ```
3. **GraphQL plugin** enabled (if using GraphQL features)

**Note:** This implementation does NOT require any external refresh token plugins. It's a completely custom solution.

## Environment Variables

Add these variables to your `.env` file:

```bash
# JWT secret for access tokens  
JWT_SECRET=your_jwt_secret_here

# Refresh token secret (should be different from JWT_SECRET)
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here

# Other required Strapi variables
ADMIN_JWT_SECRET=your_admin_jwt_secret
API_TOKEN_SALT=your_api_token_salt
TRANSFER_TOKEN_SALT=your_transfer_token_salt
ENCRYPTION_KEY=your_encryption_key
APP_KEYS=["key1", "key2", "key3", "key4"]
```

**Important:** 
- `JWT_SECRET` and `REFRESH_TOKEN_SECRET` must be different
- Use strong, randomly generated secrets for production
- Never commit secrets to version control

## REST API Endpoints

### Login
```http
POST /api/auth/local
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "confirmed": true,
    "blocked": false,
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "type": "artist"
  }
}
```

### Refresh Token
```http
POST /api/auth/refreshToken
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "confirmed": true,
    "blocked": false,
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "type": "artist"
  }
}
```

### Logout
```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
  "message": "Logged out successfully"
}
```

## GraphQL API

### Login Mutation
```graphql
mutation LoginWithRefresh($input: LoginInput!) {
  loginWithRefresh(input: $input) {
    jwt
    refreshToken
    user {
      id
      username
      email
      confirmed
      blocked
      uuid
      type
    }
  }
}
```

Variables:
```json
{
  "input": {
    "identifier": "user@example.com",
    "password": "password123"
  }
}
```

### Refresh Token Mutation
```graphql
mutation RefreshToken($input: RefreshTokenInput!) {
  refreshToken(input: $input) {
    jwt
    refreshToken
    user {
      id
      username
      email
      confirmed
      blocked
      uuid
      type
    }
  }
}
```

Variables:
```json
{
  "input": {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Logout Mutation
```graphql
mutation LogoutWithRefresh($input: RefreshTokenInput!) {
  logoutWithRefresh(input: $input)
}
```

Variables:
```json
{
  "input": {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Client-Side Implementation Example

```typescript
class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  // Use the custom refresh token endpoint
  async login(identifier: string, password: string) {
    const response = await fetch('/api/auth/local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
    });

    if (response.ok) {
      const data = await response.json();
      this.accessToken = data.jwt;
      this.refreshToken = data.refreshToken;
      
      // Store tokens securely (e.g., httpOnly cookies or secure storage)
      localStorage.setItem('refreshToken', data.refreshToken);
      
      return data;
    }
    
    throw new Error('Login failed');
  }

  // GraphQL version using custom mutation
  async loginWithGraphQL(identifier: string, password: string) {
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation LoginWithRefresh($input: LoginInput!) {
            loginWithRefresh(input: $input) {
              jwt
              refreshToken
              user {
                id
                username
                email
                confirmed
                blocked
                uuid
                type
              }
            }
          }
        `,
        variables: {
          input: { identifier, password }
        }
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      const data = result.data.loginWithRefresh;
      this.accessToken = data.jwt;
      this.refreshToken = data.refreshToken;
      
      localStorage.setItem('refreshToken', data.refreshToken);
      
      return data;
    }
    
    throw new Error('Login failed');
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('/api/auth/refreshToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      this.accessToken = data.jwt;
      this.refreshToken = data.refreshToken;
      
      localStorage.setItem('refreshToken', data.refreshToken);
      
      return data;
    }
    
    throw new Error('Token refresh failed');
  }

  async apiRequest(url: string, options: RequestInit = {}) {
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    // If token expired, try to refresh
    if (response.status === 401) {
      await this.refreshAccessToken();
      
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    }

    return response;
  }

  async logout() {
    if (this.refreshToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
    }

    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('refreshToken');
  }

  // GraphQL version using custom mutation
  async logoutWithGraphQL() {
    if (this.refreshToken) {
      await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation LogoutWithRefresh($input: RefreshTokenInput!) {
              logoutWithRefresh(input: $input)
            }
          `,
          variables: {
            input: { refreshToken: this.refreshToken }
          }
        }),
      });
    }

    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('refreshToken');
  }
}
```

## Security Considerations

1. **Secure Storage**: Store refresh tokens securely (httpOnly cookies recommended for web apps)
2. **Token Rotation**: Refresh tokens are rotated on each use to prevent replay attacks
3. **Short-lived Access Tokens**: Access tokens expire in 15 minutes to minimize exposure
4. **Logout**: Always call logout to invalidate refresh tokens
5. **Environment Variables**: Keep JWT secrets secure and different for each environment
6. **Database Privacy**: All token-related fields are marked as private and non-searchable
7. **Error Handling**: Proper error responses without exposing sensitive information

## Implementation Details

### Custom Service Integration
The implementation uses Strapi v5 plugin architecture:

```typescript
// Helper function to get users-permissions services
const getService = (name: string) => {
  return strapi.plugin('users-permissions').service(name);
};
```

This ensures compatibility with Strapi v5's new plugin export structure.

### GraphQL Schema Extensions
Custom mutations are prefixed to avoid conflicts with built-in users-permissions mutations:

- `loginWithRefresh` - Custom login with refresh token support
- `refreshToken` - Token refresh functionality  
- `logoutWithRefresh` - Logout with token invalidation

The built-in `login` and `logout` mutations from users-permissions remain available for standard authentication.

## Database Schema

The user schema has been extended with a custom `refreshToken` field:

```json
{
  "refreshToken": {
    "type": "string",
    "configurable": false,
    "private": true,
    "searchable": false
  }
}
```

- **`refreshToken`**: Stores the current valid refresh token for each user

This field is automatically managed by the authentication system.

## Configuration Files

### Plugin Configuration (`config/plugins.ts`)
```typescript
export default ({ env }) => ({
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        expiresIn: '15m',
      },
    },
  },
  'graphql': {
    enabled: true,
    config: {
      endpoint: '/graphql',
      shadowCRUD: true,
      playgroundAlways: false,
      depthLimit: 7,
      amountLimit: 100,
      apolloServer: {
        tracing: false,
      },
    },
  },
});
```

**Note:** No additional plugin configuration needed - this is a pure custom implementation.

## Troubleshooting

### Common Issues

1. **Import errors in Strapi v5**
   ```
   Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './server/utils' is not defined
   ```
   **Solution:** Use the custom `getService` helper function provided in the implementation.

2. **GraphQL mutation conflicts**
   ```
   Error: Unable to merge GraphQL type "Mutation": Field "login" already defined
   ```
   **Solution:** Use the prefixed mutations (`loginWithRefresh`, `logoutWithRefresh`) instead of overriding built-in ones.

3. **Environment variable errors**
   ```
   Error: REFRESH_TOKEN_SECRET is not defined
   ```
   **Solution:** Ensure `REFRESH_TOKEN_SECRET` is properly set in your `.env` file.

### Testing the Implementation

1. **Start the development server:**
   ```bash
   yarn develop
   ```

2. **Create a test user** via admin panel at `http://localhost:1337/admin`

3. **Test REST endpoints:**
   ```bash
   curl -X POST http://localhost:1337/api/auth/local \
     -H "Content-Type: application/json" \
     -d '{"identifier": "test@example.com", "password": "password123"}'
   ```

4. **Test GraphQL** at `http://localhost:1337/graphql`

---

## Document Status

**Last Updated:** September 2025  
**Strapi Version:** v5.23.3  
**Status:** ✅ Fully updated and tested  

This documentation reflects the current implementation with all fixes and adjustments made for Strapi v5 compatibility. All code examples and configurations are verified to work with the latest setup.
