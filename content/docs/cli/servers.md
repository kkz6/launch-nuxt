---
title: Server Commands
description: Inspect, create, update and recover servers with lctl
---

Use server IDs from `lctl servers list --json`; names are not identifiers.

```bash
lctl servers list --json
lctl servers show <server-id>
lctl servers create-options
```

`create-options` returns the backend's current provider, type, operating-system,
PHP, and plan information as JSON. Provider credentials are managed separately.

## Create

```bash
lctl servers create --name staging --provider custom_server --type php \
  --ip 192.0.2.10 --yes --json
```

For cloud provisioning, provide `--credential-id`, `--region` and `--size` from
an existing provider connection. `--name`, `--provider` and `--type` are required.
Optional settings include `--description`, `--ssh-port`, `--ssh-user`, `--os`,
`--php-version`, `--database-type`, `--ssh-key` and `--install-agent=false`.
Use the current create-options values; do not infer provider-specific values.
Creation requires confirmation (`--yes` for automation) and returns the actual
server status. A custom server may still need the dashboard's connection setup.

## Update

```bash
lctl servers update <server-id> --name production --monitoring=false --json
lctl servers update <server-id> --description='' --auto-update=true
```

Only explicitly supplied fields change. `--description=''` clears the description.
`--ssh-port` updates the stored connection port; it does not reconfigure SSH on
the server. Update and lifecycle commands can use the server in `.launchctl.yml`
when the positional ID is omitted.

## Recovery and lifecycle

```bash
lctl servers retry-provision <server-id> --yes --json
lctl servers try-connection <server-id> --yes --json
lctl servers reboot <server-id> --yes --json
lctl servers archive <server-id> --yes --json
lctl servers unarchive <server-id> --json
```

Reboot, retry and connection checks return queued receipts. Watch provisioning
with `lctl servers watch <server-id>` and inspect the server afterward.
Archive changes the launchctl record; it does not shut down or destroy the VM.
Server deletion and provider-credential management still require confirmed API
calls or the dashboard.

```bash
lctl servers watch <server-id>
lctl servers metrics <server-id> --watch
lctl servers ssh <server-id>
```
