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

## Docker database snapshot restore

Container database backups use the API workflow; `lctl databases` manages native
server databases. First inspect the snapshot history and the intended target:

```bash
lctl api GET /api/servers/<server-id>/docker/projects/<source-project-id>/databases/<source-database-id>/backup/runs --json
lctl api GET /api/servers/<server-id>/docker/projects/<target-project-id>/databases/<target-database-id> --json
```

Restoring is destructive and requires Admin or Owner access. After verifying the
snapshot and backing up the target, create a request file with the selected
snapshot and target IDs:

```json
{
  "run_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "target_database_id": "01ARZ3NDEKTSV4RRFFQ69G5FAX"
}
```

```bash
lctl api POST /api/servers/<server-id>/docker/projects/<source-project-id>/databases/<source-database-id>/backup/restore --data @restore.json --json
```

The route identifies the snapshot's source database. `target_database_id` selects
a database resource, not a raw engine database name. Omit it to restore into the
source resource. The target must have the same engine and belong to the same team
and server. The raw API command does not add an interactive confirmation.

Restore runs during the request; a successful response means the restore command
completed. A timeout or disconnect is an unknown outcome, so inspect the target
before retrying. Archive validation runs before ingestion, PostgreSQL SQL errors
fail the restore, and failed ingestion may leave partial changes.

MongoDB uses the source identity saved with the snapshot to map into the selected
target. Unknown legacy sources and full-instance snapshots are refused. Only
matching archived target collections are replaced; unrelated collections remain.
See [Restore Database](/docs/application/backups#restore-database) for validation
limits and recovery guidance.
