---
title: Databases
description: Database management API endpoints
---

Manage MySQL databases and users through the API.

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/servers/{server_id}/databases` | List databases |
| GET | `/databases/{id}` | Get database details |
| POST | `/servers/{server_id}/databases` | Create database |
| DELETE | `/databases/{id}` | Delete database |

## List Databases
```http
GET /v1/servers/{server_id}/databases
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "name": "my_app_production",
      "server_id": 1,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Get Database
```http
GET /v1/databases/{id}
```

### Response

```json
{
  "data": {
    "id": 1,
    "name": "my_app_production",
    "server_id": 1,
    "users": [
      {
        "id": 1,
        "name": "app_user"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Create Database
```http
POST /v1/servers/{server_id}/databases
```

### Request Body

```json
{
  "name": "my_database"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Database name |

### Response

```json
{
  "data": {
    "id": 2,
    "name": "my_database",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

## Delete Database
```http
DELETE /v1/databases/{id}
```

### Response

```json
{
  "message": "Database deleted successfully"
}
```

::callout{type="error"}
Deleting a database permanently removes all data and cannot be undone.
::

## Database Users
### List Users

```http
GET /v1/servers/{server_id}/database-users
```

### Create User

```http
POST /v1/servers/{server_id}/database-users
```

```json
{
  "name": "app_user",
  "password": "secure_password",
  "databases": [1, 2]
}
```

### Delete User

```http
DELETE /v1/database-users/{id}
```

## Required Permissions
| Endpoint | Permission |
|----------|------------|
| GET /databases | databases:read |
| POST /databases | databases:write |
| DELETE /databases | databases:delete |
