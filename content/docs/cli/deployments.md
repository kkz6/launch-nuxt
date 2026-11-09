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

## Rollback and queued work

```bash
lctl deploy rollback <deployment-id> --server <server-id> --site <site-id> \
  --yes --wait --timeout 600 --json
lctl deploy cancel-queued <site-id> --server <server-id> --yes --json
```

Rollback requires the chosen historical deployment ID; it does not guess the
previous version. Waiting follows the newly created rollback record.
Noninteractive rollback and queue cancellation require `--yes`.
Cancel-queued preserves running deployments and returns a cancellation count.

For automation, use an already configured CLI or secret-provided credentials
as described in [Automation](/docs/cli/automation).
