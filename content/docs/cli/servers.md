---
title: Server Commands
description: Inspect servers, open terminals, stream metrics, and follow provisioning
---

Server commands use immutable server IDs. Get them with `lctl servers list --json` or select a project default with `lctl init`.

## List and inspect

```bash
lctl servers list
lctl servers list --json
lctl servers show <server-id>
```

The detail view includes connectivity, provider, operating system, capacity, IP address, provisioning status, progress, and installed feature counts.

## Watch provisioning

```bash
lctl servers watch <server-id>
```

The tmux-friendly console displays the current REST state, then follows `server.<id>` events over a reconnecting WebSocket. It shows live connection status and supports:

| Key | Action |
| --- | --- |
| `Space` or `p` | Pause/resume rendering |
| `c` | Clear captured output |
| `↑` / `↓`, `PgUp` / `PgDn` | Scroll |
| `q` | Leave the console; the server continues provisioning |

Use NDJSON for automation. The process exits after a terminal provisioning event:

```bash
lctl servers watch <server-id> --json \
  | jq -c 'select(.event | startswith("server.provision"))'
```

## Metrics

```bash
lctl servers metrics <server-id>
lctl servers metrics <server-id> --watch
```

The watch view streams CPU, memory, disk, load, uptime, and network data. Use `--json` without `--watch` for scripts.

## Reboot

```bash
lctl servers reboot <server-id>
```

The command resolves the server first and asks for confirmation before sending the reboot request.

## Terminal access

```bash
lctl servers ssh <server-id>
lctl servers ssh <server-id> --user root
```

This opens an authenticated WebSocket terminal through launchctl. Resize events, terminal raw mode, mouse state, keepalive, and cleanup are handled by the client, so it behaves correctly inside tmux and nested SSH sessions.

For non-interactive site commands, use `lctl run`:

```bash
lctl run "php artisan migrate" --server <server-id> --site <site-id>
lctl run --history --server <server-id>
```

## Newly released server APIs

Provider creation, backups, scripts, platform updates, Docker projects, DNS, load balancers, and notification endpoints remain accessible even before a dedicated high-level command ships:

```bash
lctl api GET /api/servers/create-options
lctl api GET /api/servers/<server-id>/backups
lctl api GET /api/servers/<server-id>/docker/projects
```

Use `lctl api --help` for request bodies and self-hosted origins.
