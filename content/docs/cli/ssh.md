---
title: SSH and Remote Commands
description: Open resilient terminal sessions and run site commands safely
---

## Interactive server terminal

```bash
lctl servers ssh <server-id>
lctl servers ssh <server-id> --user root
```

The terminal is proxied over an authenticated WebSocket. The CLI preserves raw-mode cleanup, resize handling, scroll regions, keepalive, and normal close frames—even when the session exits unexpectedly.

::callout{type="info"}
The default user comes from the server record. Use `--user` only when that account exists and your launchctl permissions allow it.
::

## Run a site command

```bash
lctl run "php artisan cache:clear" \
  --server <server-id> \
  --site <site-id>
```

With project context, the IDs are optional:

```bash
lctl init
lctl run "php artisan migrate --force"
```

The command creates a remote task, polls its status, prints output, and returns the remote exit status. Review recent executions with:

```bash
lctl run --history --server <server-id>
lctl tasks list --server <server-id>
lctl tasks watch <task-id> --server <server-id>
```

## Team SSH keys

```bash
lctl ssh-keys list
lctl ssh-keys add --name "Workstation" --key ~/.ssh/id_ed25519.pub
lctl ssh-keys add --name "CI" --key ./ci.pub --global
```

Attach and detach an existing team key:

```bash
lctl ssh-keys attach <key-id> --server <server-id>
lctl ssh-keys server-list --server <server-id>
lctl ssh-keys detach <key-id> --server <server-id>
lctl ssh-keys delete <key-id>
```

Delete affects the team key; detach only removes its association with one server.

## Troubleshooting

1. Confirm connectivity with `lctl servers show <server-id>`.
2. Confirm the active account and team with `lctl whoami`.
3. Inspect attached keys with `lctl ssh-keys server-list --server <server-id>`.
4. Check firewall rules with `lctl firewall list --server <server-id>`.
5. For self-hosting, verify both HTTP and WebSocket traffic reach the origin passed with `--api-url` or `LAUNCHCTL_API_URL`.
