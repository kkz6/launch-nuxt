---
title: API Reference
description: launchctl REST API documentation for automation and integrations
---

The launchctl API allows you to programmatically manage your servers, sites, and deployments. Build custom integrations, automate workflows, and extend launchctl functionality.

## Base URL
```
https://api.launch.dev/v1
```

## Authentication
All API requests require authentication using a personal access token.

### Creating a Token

1. Go to **Settings** → **API Tokens**
2. Click **Create Token**
3. Select required permissions
4. Copy and store the token securely

### Using the Token

Include the token in the `Authorization` header:

```bash
curl -X GET "https://api.launch.dev/v1/user" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

## Rate Limiting
API requests are rate limited:

- **60 requests per minute** for most endpoints
- Rate limit headers included in responses

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
```

## Response Format
All responses are JSON formatted:

```json
{
  "data": {
    // Response data
  }
}
```

### Error Responses

```json
{
  "message": "Error description",
  "errors": {
    "field": ["Validation error"]
  }
}
```

## Available Endpoints
:::card-group
::doc-card{title="Servers" to="/docs/api/servers"}
Manage server provisioning and configuration
::
::doc-card{title="Sites" to="/docs/api/sites"}
Create and manage sites on your servers
::
::doc-card{title="Deployments" to="/docs/api/deployments"}
Trigger and monitor deployments
::
::doc-card{title="Databases" to="/docs/api/databases"}
Manage MySQL databases and users
::
::doc-card{title="SSH Keys" to="/docs/api/ssh-keys"}
Manage SSH keys for server access
::
::doc-card{title="Teams" to="/docs/api/teams"}
Access team information
::
:::

## Quick Examples
### List Servers

```bash
curl -X GET "https://api.launch.dev/v1/servers" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

### Create a Site

```bash
curl -X POST "https://api.launch.dev/v1/servers/{server_id}/sites" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "type": "laravel",
    "php_version": "8.3"
  }'
```

### Trigger Deployment

```bash
curl -X POST "https://api.launch.dev/v1/sites/{site_id}/deploy" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

## SDKs & Libraries
::callout{type="info"}
Official SDKs are coming soon. In the meantime, you can use any HTTP client to interact with the API.
::

## Webhooks
launchctl can send webhooks for various events. Configure webhook endpoints in your team settings.

### Webhook Events

- `server.created`
- `server.deleted`
- `site.created`
- `site.deleted`
- `deployment.started`
- `deployment.completed`
- `deployment.failed`

## Need Help?
If you have questions about the API:

- Check the endpoint documentation
- Review example requests
- Contact support for assistance
