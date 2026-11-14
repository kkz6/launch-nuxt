---
title: Deployments
description: Deployment management API endpoints
---

Trigger deployments and monitor deployment status through the API.

## Endpoints
---

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/servers/{server_id}/sites/{site_id}/deployments` | List deployments |
| GET | `/servers/{server_id}/sites/{site_id}/deployments/{id}` | Get deployment details |
| POST | `/servers/{server_id}/sites/{site_id}/deploy` | Trigger deployment |
| GET | `/servers/{server_id}/sites/{site_id}/releases` | Inspect actual live and retained releases |
| POST | `/servers/{server_id}/sites/{site_id}/rollback/{deployment_id}` | Queue rollback to a retained release |
| POST | `/servers/{server_id}/sites/{site_id}/runtime/refresh` | Retry PHP runtime activation without switching code |

## List Deployments
---

```http
GET /api/servers/{server_id}/sites/{site_id}/deployments
```

### Response

```json
{
  "data": [
    {
      "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "site_id": "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      "git_hash": "abc123",
      "is_rollback": false,
      "status": "finished",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:32:00Z"
    }
  ]
}
```

## Get Deployment
---

```http
GET /api/servers/{server_id}/sites/{site_id}/deployments/{id}
```

### Response

```json
{
  "data": {
    "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "site_id": "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    "git_hash": "abc123def456",
    "is_rollback": false,
    "status": "finished",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:32:00Z"
  }
}
```

### Deployment Status

| Status | Description |
|--------|-------------|
| pending | Waiting to start |
| queued | Waiting for another deployment to finish |
| installing | Deployment in progress |
| finished | Deployment completed successfully |
| failed | Deployment failed |
| timeout | Deployment timed out |

## Trigger Deployment
---

```http
POST /api/servers/{server_id}/sites/{site_id}/deploy
```

Uses the site’s configured repository and branch. No request body is required.

### Response

```json
{
  "data": {
    "id": "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    "status": "pending",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

## Live Releases and Rollback

The releases endpoint returns `data.status` (`available`, `busy`, `unavailable`, or
`unsupported`), `checked_at`, `active_release`, and a `releases` array. Each release
has `release_name`, `deployment_id`, `deployment_ids`, `status`, `active`,
`rollback_available`, and `unavailable_reason`. `status` on a release describes its
associated history, not application health. Busy or unavailable observations must
not be used to infer what is live.

Use the eligible release's `deployment_id` in the rollback URL. No request body is
required. The response contains a new pending deployment; follow that record until
it finishes. A fresh inventory check rejects active, removed, or unverified targets,
and the remote task validates again under the deployment lock before switching.

Rollback restores retained code, without reversing database migrations or replacing
shared files. It does not replay deployment hooks. See
[Rollback and PHP runtime recovery](/docs/application/sites/deployment#rollback).

## PHP Runtime Refresh

The runtime refresh endpoint requires no body and returns
`{"data":{"status":"queued"}}` within the normal API response envelope. It retries
PHP activation for the current release without creating a deployment or switching
code. Repeated pending requests are deduplicated.

Follow `deployment.runtime.started`, `deployment.runtime.completed`, and
`deployment.runtime.failed` events. They include `site_id`, `server_id`, and a
`task_id` when execution has created a task. The task stores execution diagnostics.
PHP-FPM reloads affect all sites using that PHP version; configured managed-worker
restarts remain separate tasks. Completion does not certify HTTP health.

## Deployment Webhook
---

You can also trigger deployments via webhook URL:

```http
POST /deploy/{site_id}/{site_token}
```

This endpoint uses the secret site token instead of a user session. Treat the full URL as a credential. Site detail responses include deployment credentials only for Editor, Admin, or Owner sessions with deployment access; Member and Spectate sessions do not receive them. Site lists and shared WebSocket messages never include deployment credentials. Token regeneration requires Admin or Owner access.

## Required Permissions
---

| Action | Minimum team role |
|--------|-------------------|
| Read deployment history, details, and release inventory | Member |
| Deploy, roll back, refresh PHP runtime, cancel queued deployments, or change auto-deploy settings | Editor |
| Regenerate a deployment token | Admin |

Higher roles inherit these permissions. Spectate sessions remain read-only. Switching teams applies the selected team's role; it does not carry permissions from the previous team.
