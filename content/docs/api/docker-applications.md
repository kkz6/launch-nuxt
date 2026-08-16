---
title: Docker Applications API
description: Create, configure, deploy, and monitor Docker applications through the REST API or lctl
---

Docker application endpoints are nested under a provisioned Docker server and project:

```text
/api/servers/{serverId}/docker/projects/{projectId}/applications
```

Use a personal access token with the normal API client, or let `lctl api` supply the active profile, token, and team context. The examples below use `lctl` and therefore keep the `/api` prefix.

## Discover IDs

```bash
lctl servers list --json
lctl api GET /api/servers/<server-id>/docker/projects
lctl api GET /api/servers/<server-id>/docker/projects/<project-id>/applications
```

Never guess IDs. Resolve the server, project, and application before mutating a workload.

## Project endpoints

| Method   | Path                                                  | Purpose                      |
| -------- | ----------------------------------------------------- | ---------------------------- |
| `GET`    | `/api/servers/{serverId}/docker/projects`             | List projects                |
| `POST`   | `/api/servers/{serverId}/docker/projects`             | Create a project             |
| `GET`    | `/api/servers/{serverId}/docker/projects/{projectId}` | Get one project              |
| `PATCH`  | `/api/servers/{serverId}/docker/projects/{projectId}` | Rename or describe a project |
| `DELETE` | `/api/servers/{serverId}/docker/projects/{projectId}` | Delete an empty project      |

Create a project:

```bash
lctl api POST /api/servers/<server-id>/docker/projects \
  --data '{"name":"acme-prod","description":"Production workloads"}'
```

## Create an application

Exactly one source object must match `source_type`. `internal_port` defaults to `80` and must be between 1 and 65535.

### Pre-built image

```bash
lctl api POST /api/servers/<server-id>/docker/projects/<project-id>/applications \
  --data '{
    "name": "web",
    "source_type": "image",
    "internal_port": 80,
    "image": {"image": "nginx:1.27"}
  }'
```

For a private registry, add either `registry_credential_id` or inline `registry_username`, `registry_password`, and optional `registry_url`. Do not send saved and inline credentials together.

### Git with automatic builder selection

```bash
lctl api POST /api/servers/<server-id>/docker/projects/<project-id>/applications \
  --data '{
    "name": "api",
    "source_type": "git",
    "internal_port": 3000,
    "git": {
      "repo": "https://github.com/acme/api.git",
      "branch": "main"
    }
  }'
```

Optional Git fields are `source_control_id`, `build_type` (`nixpacks` or `dockerfile`), `dockerfile_path`, and `build_location` (`server` or `github_actions`). GitHub Actions builds require a connected GitHub source control.

### Inline Dockerfile

Store larger or multiline payloads in a file to avoid shell quoting errors:

```json
{
  "name": "worker",
  "source_type": "dockerfile",
  "internal_port": 8080,
  "dockerfile": {
    "contents": "FROM caddy:2-alpine\nEXPOSE 8080"
  }
}
```

```bash
lctl api POST /api/servers/<server-id>/docker/projects/<project-id>/applications \
  --data @application.json
```

## Application endpoints

Let `BASE` represent `/api/servers/{serverId}/docker/projects/{projectId}/applications/{applicationId}`.

| Method   | Path                                        | Purpose                                                                |
| -------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `BASE`                                      | Get current application configuration and status                       |
| `PATCH`  | `BASE`                                      | Update name or Git builder settings                                    |
| `DELETE` | `BASE`                                      | Remove the application and preserve named volumes                      |
| `DELETE` | `BASE?remove_volumes=true`                  | Remove the application and its named volumes                           |
| `POST`   | `BASE/deploy`                               | Queue a build/deployment                                               |
| `POST`   | `BASE/reload`                               | Restart the existing container without applying new environment values |
| `POST`   | `BASE/stop`                                 | Stop the container                                                     |
| `POST`   | `BASE/start`                                | Start the container                                                    |
| `GET`    | `BASE/deployments`                          | List deployment history                                                |
| `DELETE` | `BASE/deployments/{deploymentId}`           | Delete a history row                                                   |
| `GET`    | `BASE/deployments/{deploymentId}/gha-steps` | Read GitHub Actions jobs and steps                                     |

`POST BASE/deploy` returns when work has been queued, not when the container is running. Watch events and reconcile the final state.

## Configuration endpoints

| Area                 | Endpoints below `BASE`                                                              |
| -------------------- | ----------------------------------------------------------------------------------- |
| Runtime environment  | `GET/POST/PUT /env-vars`, `PATCH/DELETE /env-vars/{id}`                             |
| Build secrets        | `GET/POST /build-secrets`, `PATCH/DELETE /build-secrets/{id}`                       |
| Domains              | `GET/POST /domains`, `PATCH/DELETE /domains/{id}`, `GET /domains/{id}/validate-dns` |
| Redirects            | `GET/POST /redirects`, `PATCH/DELETE /redirects/{id}`                               |
| Volumes              | `GET/POST /volumes`, `PATCH/DELETE /volumes/{id}`                                   |
| Schedules            | `GET/POST /schedules`, `PATCH/DELETE /schedules/{id}`                               |
| Runtime and security | `PATCH /advanced`                                                                   |
| Traefik file         | `GET/PATCH /traefik-config`                                                         |

Runtime secret values are masked in list responses. Build-secret values are write-only and are never returned.

## GitHub Actions endpoints

| Method | Path                    | Purpose                                                |
| ------ | ----------------------- | ------------------------------------------------------ |
| `POST` | `BASE/gha/resync`       | Re-render and publish workflow, variables, and secrets |
| `POST` | `BASE/gha/rotate-token` | Rotate the deployment callback token                   |
| `POST` | `BASE/gha/auto-deploy`  | Set `{ "enabled": true }` or `false`                   |
| `POST` | `BASE/gha/disable`      | Return the application to server-side builds           |

These endpoints queue background work. Follow `docker.application.gha_synced`, `docker.application.gha_permissions_missing`, or `docker.application.gha_installation_broken`, then fetch the application again.

## Live progress

Open the event stream before triggering a deployment when possible:

```bash
lctl events --filter 'docker.application.*' --filter 'deployment.gha_steps'
```

For automation, emit NDJSON:

```bash
lctl events --json --filter 'docker.application.*' \
  | jq -c 'select(.data.application_id == "<application-id>")'
```

Important lifecycle events include `docker.application.deploying`, `docker.application.deployed`, `docker.application.failed`, `docker.application.updated`, and `deployment.gha_steps`.

After a terminal event, reconcile both resources:

```bash
lctl api GET /api/projects/{projectId}/environments/{environmentId}/applications/{applicationId}
lctl api GET /api/projects/{projectId}/environments/{environmentId}/applications/{applicationId}/deployments
```

Do not treat an accepted or queued response as a successful deployment.
