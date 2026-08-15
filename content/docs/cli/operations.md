---
title: Operations Commands
description: Services, databases, keys, firewall, cron, daemons, logs, and certificates
---

Most server-scoped commands accept `--server <id>` or resolve the server from `.launchctl.yml`.

## Services

```bash
lctl services list --server <server-id>
lctl services start <service-id> --server <server-id>
lctl services stop <service-id> --server <server-id>
lctl services restart <service-id> --server <server-id>
```
## Databases

```bash
lctl databases list --server <server-id>
lctl databases users --server <server-id>
lctl databases create --server <server-id>
lctl databases delete <database-id> --server <server-id>
```

Creation is interactive and can create a database user with a password in the same workflow. Deletion asks for confirmation.

## Firewall

```bash
lctl firewall list --server <server-id>
lctl firewall add --server <server-id>
lctl firewall delete <rule-id> --server <server-id>
```

The add form captures allow/deny action, port, optional source IPv4, and a note.

## Cron jobs

```bash
lctl cron list --server <server-id>
lctl cron add --server <server-id>
lctl cron delete <cron-id> --server <server-id>
```

## Daemons

```bash
lctl daemons list --server <server-id>
lctl daemons add --server <server-id>
lctl daemons restart <daemon-id> --server <server-id>
lctl daemons delete <daemon-id> --server <server-id>
```

The add workflow captures command, user, optional working directory, and process count.

## SSH keys

```bash
lctl ssh-keys list
lctl ssh-keys add --name "Laptop" --key ~/.ssh/id_ed25519.pub
lctl ssh-keys attach <key-id> --server <server-id>
lctl ssh-keys server-list --server <server-id>
lctl ssh-keys detach <key-id> --server <server-id>
lctl ssh-keys delete <key-id>
```

## Logs and TLS

```bash
lctl logs --server <server-id>
lctl logs --server <server-id> --type nginx --lines 100 --follow
lctl logs --server <server-id> --site <site-id> --type laravel
lctl ssl list --server <server-id> --site <site-id>
```

List commands support `--json`. Newer operational modules such as backups, scripts, platform updates, notifications, DNS, Docker workloads, and load balancers can be called through `lctl api` immediately.
