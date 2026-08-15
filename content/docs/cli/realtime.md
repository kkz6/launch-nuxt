---
title: Live Operations
description: Reconnecting WebSocket consoles for dashboards, tasks, provisioning, and events
---

The CLI uses one resilient pub/sub manager for launchctl events. It sends heartbeats, reconnects with capped exponential backoff, and restores every authorized subscription after a disconnect.

## Team event console

```bash
lctl events
lctl events --filter 'deployment.*' --filter 'task.*'
lctl events --channel server.<server-id>
```
The active team channel is automatic. Additional channels use `resource.id` syntax:

| Channel | Typical events |
| --- | --- |
| `team.<id>` | Model changes and deployments across a team |
| `server.<id>` | Provisioning and server lifecycle |
| `site.<id>` | Site installation and updates |
| `deployment.<id>` | Deployment lifecycle |
| `task.<id>` | Output, progress, markers, and status |
| `user.<id>` | User-specific notifications |

The server validates that every resource belongs to the authenticated team. Malformed, unknown, or cross-team subscriptions return `subscription.error` and are not registered.

## Task console

```bash
lctl tasks list --server <server-id>
lctl tasks watch <task-id> --server <server-id>
```

Stored output appears first, followed by `task.output`, `task.progress`, `task.status`, and task marker events. This is the best view for long installs, backups, scripts, and remote commands.

## Server provisioning

```bash
lctl servers watch <server-id>
```

The view starts from the server's current REST status and follows its resource channel. It remains useful if provisioning began before the console opened.

## Dashboard convergence

```bash
lctl status
```

Any team event triggers an immediate dashboard refresh. A 30-second REST interval remains as reconciliation, so state converges after missed or out-of-order events.

## NDJSON mode

Live commands honor `--json` and print one event per line:

```bash
lctl events --json \
  | jq -c 'select(.event == "deployment.failed")'
```

Each line contains `event`, `channel`, and `data`. This framing is safe for pipes and does not require parsing terminal styling.

## tmux layout

```bash
tmux new-session -d -s launch 'lctl status'
tmux split-window -h 'lctl events --filter "deployment.*"'
tmux split-window -v 'lctl tasks watch <task-id> --server <server-id>'
tmux attach -t launch
```

All full-screen views respond to terminal resize events and leave the alternate screen cleanly.
