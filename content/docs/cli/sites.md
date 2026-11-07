---
title: Site Commands
description: Create, update, deploy and remove native sites
---

These commands manage native PHP/static sites. Use [Docker commands](/docs/cli/docker)
for container workloads. Server and optional site IDs resolve from `.launchctl.yml`.

```bash
lctl sites list --server <server-id> --json
lctl sites show <site-id> --server <server-id> --json
```

## Create and update

```bash
lctl sites create --server <server-id> --address example.com \
  --type laravel --php-version php84 --web-folder public --json
lctl sites update <site-id> --server <server-id> --branch main \
  --release-retention 5 --queue-deployments=false --json
```

Creation requires `--address`, `--type` and `--php-version`. Supported native
types are `laravel`, `wordpress`, `static`, `generic` and `phpmyadmin`.
Repository settings use `--source-control`, `--repository-id` and `--branch`;
these are saved connection/repository identifiers, not arbitrary repository URLs.

Updates support `--php-version`, `--web-folder`, `--branch`, `--release-retention`
and `--queue-deployments`. Omitted fields stay unchanged; explicit empty strings
clear supported fields and `--queue-deployments=false` disables queuing.
PHP changes may be pending while a background task runs; inspect the returned
status and `pending_php_version` rather than assuming the change completed.

## Auto-deploy and deletion

```bash
lctl sites auto-deploy enable <site-id> --server <server-id> --json
lctl sites auto-deploy disable <site-id> --server <server-id> --json
lctl sites delete <site-id> --server <server-id> --yes --json
```

Deletion requires confirmation and is asynchronous. A `deletion_requested`
receipt means cleanup was requested, not finished. Site hooks, TLS changes,
queue-worker configuration, and optional database/DNS provisioning remain
available through the backend API or dashboard.

## Environment, logs and commands

```bash
lctl env pull --server <server-id> --site <site-id> --output .env.local
lctl env push --server <server-id> --site <site-id> --file .env.local
lctl logs --server <server-id> --site <site-id>
lctl run "php artisan about" --server <server-id> --site <site-id>
lctl ssl list --server <server-id> --site <site-id>
```

Environment output and the current push diff can contain secrets. Do not copy
that output into shared logs. Environment editing and several older operations
remain interactive; the global `--json` flag does not guarantee structured
output for every mutation.
