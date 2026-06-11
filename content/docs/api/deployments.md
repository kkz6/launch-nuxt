---
title: Deployments
description: Deployment management API endpoints
---

Trigger deployments and monitor deployment status through the API.

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sites/{site_id}/deployments` | List deployments |
| GET | `/deployments/{id}` | Get deployment details |
| POST | `/sites/{site_id}/deploy` | Trigger deployment |

## List Deployments
```http
GET /v1/sites/{site_id}/deployments
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "site_id": 1,
      "commit_hash": "abc123",
      "commit_message": "Fix bug in login",
      "status": "finished",
      "started_at": "2024-01-15T10:30:00Z",
      "finished_at": "2024-01-15T10:32:00Z"
    }
  ]
}
```

## Get Deployment
```http
GET /v1/deployments/{id}
```

### Response

```json
{
  "data": {
    "id": 1,
    "site_id": 1,
    "commit_hash": "abc123def456",
    "commit_message": "Fix bug in login",
    "commit_author": "John Doe",
    "branch": "main",
    "status": "finished",
    "output": "Deployment log output...",
    "started_at": "2024-01-15T10:30:00Z",
    "finished_at": "2024-01-15T10:32:00Z"
  }
}
```

### Deployment Status

| Status | Description |
|--------|-------------|
| pending | Deployment queued |
| deploying | Deployment in progress |
| finished | Deployment completed successfully |
| failed | Deployment failed |

## Trigger Deployment
```http
POST /v1/sites/{site_id}/deploy
```

### Request Body (Optional)

```json
{
  "branch": "main",
  "commit": "abc123"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| branch | string | No | Branch to deploy (default: configured branch) |
| commit | string | No | Specific commit to deploy |

### Response

```json
{
  "data": {
    "id": 5,
    "status": "pending",
    "started_at": "2024-01-15T12:00:00Z"
  }
}
```

## Deployment Webhook
You can also trigger deployments via webhook URL:

```http
POST /deploy/{site_token}
```

This endpoint doesn't require authentication - it uses a unique site token.

## Required Permissions
| Endpoint | Permission |
|----------|------------|
| GET /deployments | sites:read |
| POST /deploy | sites:write |
