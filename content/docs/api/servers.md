---
title: Servers
description: Server management API endpoints
---

Manage server provisioning, configuration, and monitoring through the API.

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/servers` | List all servers |
| GET | `/servers/{id}` | Get server details |
| POST | `/servers` | Create a new server |
| PUT | `/servers/{id}` | Update server |
| DELETE | `/servers/{id}` | Delete server |

## List Servers
```http
GET /v1/servers
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "name": "production-web",
      "ip_address": "192.168.1.100",
      "provider": "digitalocean",
      "region": "nyc1",
      "size": "s-2vcpu-4gb",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Get Server
```http
GET /v1/servers/{id}
```

### Response

```json
{
  "data": {
    "id": 1,
    "name": "production-web",
    "ip_address": "192.168.1.100",
    "provider": "digitalocean",
    "region": "nyc1",
    "size": "s-2vcpu-4gb",
    "status": "active",
    "php_version": "8.3",
    "database_type": "mysql",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Create Server
```http
POST /v1/servers
```

### Request Body

```json
{
  "name": "my-server",
  "provider": "digitalocean",
  "credential_id": 1,
  "region": "nyc1",
  "size": "s-2vcpu-4gb",
  "php_version": "8.3"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Server name |
| provider | string | Yes | Cloud provider (digitalocean, aws, linode, vultr, hetzner) |
| credential_id | integer | Yes | Provider credential ID |
| region | string | Yes | Server region |
| size | string | Yes | Server size/plan |
| php_version | string | No | PHP version (default: 8.3) |

### Response

```json
{
  "data": {
    "id": 2,
    "name": "my-server",
    "status": "provisioning",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

## Update Server
```http
PUT /v1/servers/{id}
```

### Request Body

```json
{
  "name": "updated-server-name"
}
```

## Delete Server
```http
DELETE /v1/servers/{id}
```

### Response

```json
{
  "message": "Server deleted successfully"
}
```

::callout{type="warning"}
Deleting a server is permanent and cannot be undone.
::

## Required Permissions
| Endpoint | Permission |
|----------|------------|
| GET /servers | servers:read |
| POST /servers | servers:write |
| PUT /servers | servers:write |
| DELETE /servers | servers:delete |
