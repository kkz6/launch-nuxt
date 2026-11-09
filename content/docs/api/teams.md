---
title: Teams
description: Team management API endpoints
---

Access team information through the API.

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teams` | List teams |
| GET | `/teams/{id}` | Get team details |
| GET | `/user` | Get current user |

## List Teams
```http
GET /v1/teams
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "name": "My Team",
      "personal_team": true,
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "name": "Acme Inc",
      "personal_team": false,
      "created_at": "2024-01-20T10:30:00Z"
    }
  ]
}
```

## Get Team
```http
GET /v1/teams/{id}
```

### Response

```json
{
  "data": {
    "id": 1,
    "name": "My Team",
    "personal_team": true,
    "owner": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "members": [
      {
        "id": 2,
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "admin"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Get Current User
```http
GET /v1/user
```

### Response

```json
{
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "current_team_id": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Required Permissions

Authorization uses the caller's role in the selected team: Member is read-only, Editor can deploy and edit resources, and Admin/Owner can perform restricted actions such as deleting servers/sites. Team settings and member role changes require Owner access. See [team roles](/docs/application/teams#member-roles).

A denied team-role action returns `403` with code `permission.denied`. Spectate writes return `403` with code `permission.read_only`, regardless of the target user's team role. Switching accounts or teams does not retain the previous context's permissions.

| Endpoint | Permission |
|----------|------------|
| GET /teams | teams:read |
| GET /user | (any valid token) |
