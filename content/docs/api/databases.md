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

## Container Database Snapshot Restore

Docker-managed databases have a separate restore endpoint:

```http
POST /api/servers/{server_id}/docker/projects/{source_project_id}/databases/{source_database_id}/backup/restore
```

```json
{
  "run_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "target_database_id": "01ARZ3NDEKTSV4RRFFQ69G5FAX"
}
```

`run_id` must identify a successful snapshot belonging to the source database's
backup configuration. The optional `target_database_id` is a database resource ID;
omitting it selects the source resource. The target must belong to the same team
and server and use the same engine. Admin or Owner access is required.

Restore executes synchronously. Success returns the normal response envelope with
`message: "Restore complete"` (with no data payload), and emits
`docker.database.backup.restored` with the source and target IDs. Download,
archive-validation, execution, and database-client failures return errors without
a restored event. A lost client connection does not establish whether remote work
completed; inspect target state before retrying.

The archive is checked completely before ingestion. PostgreSQL runs with startup
files disabled and stops on SQL errors. An ingest failure may leave partial
changes; the operation is not an atomic database replacement.

New backup-run responses include `source_database` when recorded. It identifies
the database actually dumped, independently of later configuration changes. An
absent value means unknown legacy metadata; an empty value means a full-instance
snapshot. MongoDB restore maps this recorded source into the authorized target. Existing matching target collections are
dropped; unrelated collections and databases remain intact. Legacy snapshots with
unknown source identity, full-instance snapshots, and absent source namespaces are
rejected before writes. Current backup settings are not used to guess an old
snapshot's source. See [restore guidance](/docs/application/backups#restore-database).
