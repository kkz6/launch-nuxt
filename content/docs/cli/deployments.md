---
title: Deployment Commands
description: Deploy, wait, inspect logs, roll back and cancel queued deployments
---

Deploying, rolling back, and cancelling queued deployments require Editor, Admin, or Owner access in the selected team. Members can inspect deployment history and logs. Check `lctl whoami --json` and the selected team after switching accounts or teams; permissions do not carry across teams. Spectate sessions are always read-only. Ask the team owner to change your role if needed.

## Trigger and wait

```bash
lctl deploy trigger <site-id> --server <server-id>
lctl deploy trigger --wait --timeout 600 --json
```

The second form uses `.launchctl.yml`. Interactive terminals show live progress;
noninteractive use returns a receipt. `--wait` works independently of `--ci` and
returns the final deployment record with `--json`. Failure, backend timeout,
local timeout and cancellation exit unsuccessfully. Stopping a local wait does
not cancel the remote deployment.

## History and logs

```bash
lctl deploy list <site-id> --server <server-id> --json
lctl deploy show <deployment-id> --server <server-id> --site <site-id> --json
lctl deploy logs <site-id> <deployment-id> --server <server-id> --json
lctl deploy logs <site-id> --server <server-id> --follow --json
```

Stored output is fetched by the exact task ID, including older tasks outside
the recent-task list. JSON logs contain a `deployment` object and an optional
`task` object. `--follow --json` emits changed snapshots as newline-delimited
JSON. Plain noninteractive follow emits appended output. Following a failed or
timed-out deployment exits unsuccessfully, including one already terminal when
following starts. The live view reconciles REST state when events are missed.

### Live and retained releases

History status does not identify the currently serving code. Inspect the actual
release inventory before choosing a rollback target:

```bash
lctl api GET /api/servers/<server-id>/sites/<site-id>/releases --json
```

`active_release` is the observed `current` link. Each retained release includes its
associated deployment IDs, `active`, `rollback_available`, and any unavailable
reason. Only use an eligible `deployment_id` for rollback. An unavailable or busy
inventory is not evidence that the latest finished deployment is live. Retention
can remove code while preserving its history; failed attempts can become live
before a later step fails.

## Rollback and queued work

```bash
lctl deploy rollback <deployment-id> --server <server-id> --site <site-id> \
  --yes --wait --timeout 600 --json
lctl deploy cancel-queued <site-id> --server <server-id> --yes --json
```

Rollback requires the chosen historical deployment ID; it does not guess the
previous version. Waiting follows the newly created rollback record.
The site must use zero-downtime deployment and the selected release must still
exist on the server. Deployment history can include releases already removed by
retention cleanup. Rollback switches code only: it does not restore the database,
reverse migrations, replace shared `.env` or uploaded files, or rerun deployment
hooks. A successful request queues the operation; use `--wait` to check its final
result.
Noninteractive rollback and queue cancellation require `--yes`.
Cancel-queued preserves running deployments and returns a cancellation count.

## Retry PHP runtime activation

PHP deployment and rollback gracefully reload the selected PHP-FPM service after
switching code. If that reload fails, the operation fails but the new `current`
link remains in place. The task log records both outcomes. Retry only the runtime
step with:

```bash
lctl api POST /api/servers/<server-id>/sites/<site-id>/runtime/refresh --json
lctl events --filter 'deployment.runtime.*'
```

The POST response means queued. Use the event's `task_id` with
`lctl tasks watch <task-id> --server <server-id>` to inspect execution. If you start
watching after completion, use the site's server task history and release inventory
to reconcile the result. This recovery action does not switch releases or rerun
hooks, migrations, or builds. It requires Editor, Admin, or Owner access.

The FPM reload affects sites sharing the selected PHP version. Configured managed
workers restart separately when **Auto-restart queues** is enabled; PHP refresh
completion does not confirm worker completion or application HTTP health.

For automation, use an already configured CLI or secret-provided credentials
as described in [Automation](/docs/cli/automation).
