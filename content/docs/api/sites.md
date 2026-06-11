---
title: Sites
description: Site management API endpoints
---

Create and manage sites on your servers through the API.

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/servers/{server_id}/sites` | List sites on server |
| GET | `/sites/{id}` | Get site details |
| POST | `/servers/{server_id}/sites` | Create a new site |
| PUT | `/sites/{id}` | Update site |
| DELETE | `/sites/{id}` | Delete site |

## List Sites
```http
GET /v1/servers/{server_id}/sites
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "domain": "example.com",
      "type": "laravel",
      "php_version": "8.3",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Get Site
```http
GET /v1/sites/{id}
```

### Response

```json
{
  "data": {
    "id": 1,
    "server_id": 1,
    "domain": "example.com",
    "type": "laravel",
    "php_version": "8.3",
    "web_directory": "public",
    "repository": "github.com/user/repo",
    "branch": "main",
    "ssl_enabled": true,
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Create Site
```http
POST /v1/servers/{server_id}/sites
```

### Request Body

```json
{
  "domain": "example.com",
  "type": "laravel",
  "php_version": "8.3",
  "web_directory": "public"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| domain | string | Yes | Domain name |
| type | string | Yes | Site type (laravel, php, static, wordpress) |
| php_version | string | No | PHP version |
| web_directory | string | No | Public web directory |

### Response

```json
{
  "data": {
    "id": 2,
    "domain": "example.com",
    "status": "installing",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

## Update Site
```http
PUT /v1/sites/{id}
```

### Request Body

```json
{
  "php_version": "8.4",
  "web_directory": "public"
}
```

## Delete Site
```http
DELETE /v1/sites/{id}
```

### Response

```json
{
  "message": "Site deleted successfully"
}
```

## Required Permissions
| Endpoint | Permission |
|----------|------------|
| GET /sites | sites:read |
| POST /sites | sites:write |
| PUT /sites | sites:write |
| DELETE /sites | sites:delete |
