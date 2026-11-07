---
title: Docker Commands
description: Manage projects, applications and Compose stacks
---

Docker commands require a Docker application server. Pass `--server` and
`--project`, or use the corresponding defaults in `.launchctl.yml`.

## Projects and applications

```bash
lctl docker projects list --server <server-id> --json
lctl docker projects create --server <server-id> --name production --json
lctl docker applications list --server <server-id> --project <project-id> --json
lctl docker applications show <application-id> --server <server-id> --project <project-id> --json
lctl docker applications deploy <application-id> --server <server-id> --project <project-id> --wait --timeout 600 --json
```

Applications support image, Git and inline Dockerfile sources, create/update,
start/stop/reload, deployment history and deletion. Use command help for the
source-specific required flags. Application reload recreates the container with
its current environment/configuration; it neither rebuilds nor pulls an image
and does not create a deployment-history row.

## Compose stacks

```bash
lctl docker composes list --server <server-id> --project <project-id> --json
lctl docker composes create --server <server-id> --project <project-id> \
  --name web --file compose.yml --json
lctl docker composes show <compose-id> --server <server-id> --project <project-id> --json
lctl docker composes deploy <compose-id> --server <server-id> --project <project-id> \
  --wait --timeout 600 --json
lctl docker composes deployments <compose-id> --server <server-id> --project <project-id> --json
```

`docker compose` is an alias for `docker composes`. Creation registers local
Compose YAML (maximum 128 KiB); deploy is a separate action. Existing Git-sourced
stacks can be inspected and deployed, but Git-source creation and registry
attachment currently use the API/dashboard.

```bash
lctl docker composes update <compose-id> --server <server-id> --project <project-id> --name web-v2
lctl docker composes update <compose-id> --server <server-id> --project <project-id> --env-file .env.production
lctl docker composes reload <compose-id> --server <server-id> --project <project-id> --yes --json
lctl docker composes delete <compose-id> --server <server-id> --project <project-id> --yes --json
```

Update supports name, `--env-file` and `--run-command`. An empty environment file
clears saved variables; `--run-command=''` resets the override. The backend does
not patch Compose source/YAML through this endpoint. Environment changes apply
on deploy or reload; command overrides apply on deploy.

Default JSON output redacts saved YAML, environment and command contents.
Explicit `show --json --show-config` reveals that configuration and can expose
secrets. Do not put it in shared logs.

Reload and delete return queued receipts. Deployment waiting checks the exact
returned deployment record, not service health. Inspect the stack after deploy.
Deletion preserves named volumes unless `--remove-volumes` is explicitly used.
Reload/deletion require `--yes` when noninteractive. Container database commands,
application subresources and advanced Compose configuration remain API workflows.
