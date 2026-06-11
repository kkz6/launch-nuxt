---
title: SSH Keys
description: SSH key management API endpoints
---

Manage SSH keys for server access through the API.

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/servers/{server_id}/ssh-keys` | List SSH keys |
| GET | `/ssh-keys/{id}` | Get SSH key details |
| POST | `/servers/{server_id}/ssh-keys` | Add SSH key |
| DELETE | `/ssh-keys/{id}` | Remove SSH key |

## List SSH Keys
```http
GET /v1/servers/{server_id}/ssh-keys
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "name": "My MacBook",
      "fingerprint": "SHA256:abc123...",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Get SSH Key
```http
GET /v1/ssh-keys/{id}
```

### Response

```json
{
  "data": {
    "id": 1,
    "name": "My MacBook",
    "public_key": "ssh-ed25519 AAAA...",
    "fingerprint": "SHA256:abc123...",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Add SSH Key
```http
POST /v1/servers/{server_id}/ssh-keys
```

### Request Body

```json
{
  "name": "My SSH Key",
  "public_key": "ssh-ed25519 AAAA... user@example.com"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Key name |
| public_key | string | Yes | Public key content |

### Response

```json
{
  "data": {
    "id": 2,
    "name": "My SSH Key",
    "fingerprint": "SHA256:xyz789...",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

## Delete SSH Key
```http
DELETE /v1/ssh-keys/{id}
```

### Response

```json
{
  "message": "SSH key deleted successfully"
}
```

::callout{type="warning"}
Removing an SSH key immediately revokes server access for that key.
::

## Required Permissions
| Endpoint | Permission |
|----------|------------|
| GET /ssh-keys | ssh-keys:read |
| POST /ssh-keys | ssh-keys:write |
| DELETE /ssh-keys | ssh-keys:delete |
