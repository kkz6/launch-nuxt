# Dashboard API Specification

## Endpoint

```
GET /dashboard
```

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token |
| X-Team-ID | Yes | Current team ID |

## Response

```json
{
  "data": {
    "servers": [
      {
        "id": "uuid",
        "name": "production-web-01",
        "status": "connected",
        "provider": "digitalocean",
        "sites_count": 4
      }
    ],
    "recent_activity": [
      {
        "id": "uuid",
        "site_name": "api.example.com",
        "site_id": "uuid",
        "server_id": "uuid",
        "server_name": "production-web-01",
        "status": "finished",
        "created_at": "2026-01-19T10:30:00Z",
        "commit_sha": "a1b2c3d",
        "user": {
          "name": "Karthick"
        }
      }
    ]
  }
}
```

## Field Descriptions

### servers[]

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Server ID |
| name | string | Server name |
| status | string | `connected` or `disconnected` based on agent connection |
| provider | string | `digitalocean`, `hetzner`, `vultr`, `linode`, `aws`, `custom_server` |
| sites_count | integer | Number of sites on this server |

### recent_activity[]

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Deployment ID |
| site_name | string | Site address/domain |
| site_id | uuid | Site ID |
| server_id | uuid | Server ID |
| server_name | string | Server name |
| status | string | `finished`, `deploying`, `failed`, or `pending` |
| created_at | string | ISO 8601 timestamp |
| commit_sha | string | First 7 characters of commit SHA |
| user.name | string | Name of user who triggered deployment |

## Requirements

1. Return up to **8 servers** for the current team, ordered by most recently used/accessed
2. Return up to **6 recent deployments** across all sites for the current team, ordered by `created_at` desc
3. Respect team context via `X-Team-ID` header

## Example Response

```json
{
  "data": {
    "servers": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "production-web-01",
        "status": "connected",
        "provider": "digitalocean",
        "sites_count": 4
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "name": "staging-server",
        "status": "disconnected",
        "provider": "hetzner",
        "sites_count": 2
      }
    ],
    "recent_activity": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "site_name": "api.example.com",
        "site_id": "770e8400-e29b-41d4-a716-446655440001",
        "server_id": "550e8400-e29b-41d4-a716-446655440001",
        "server_name": "production-web-01",
        "status": "finished",
        "created_at": "2026-01-19T10:30:00Z",
        "commit_sha": "a1b2c3d",
        "user": {
          "name": "Karthick"
        }
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440002",
        "site_name": "app.example.com",
        "site_id": "770e8400-e29b-41d4-a716-446655440002",
        "server_id": "550e8400-e29b-41d4-a716-446655440001",
        "server_name": "production-web-01",
        "status": "deploying",
        "created_at": "2026-01-19T10:25:00Z",
        "commit_sha": "e4f5g6h",
        "user": {
          "name": "John"
        }
      }
    ]
  }
}
```
