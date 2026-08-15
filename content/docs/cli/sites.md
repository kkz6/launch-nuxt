---
title: Site Commands
description: Inspect sites and operate project files, logs, services, and TLS
---

## List and inspect

```bash
lctl sites list --server <server-id>
lctl sites show <site-id> --server <server-id>
```

Both commands support `--json`. After running `lctl init`, the server can be resolved from `.launchctl.yml`:

```bash
lctl sites list
```

## Project context

Run the interactive initializer from a repository:

```bash
lctl init
```

It creates:

```yaml
server: 01SERVERID
site: 01SITEID
```

The CLI searches parent directories for `.launchctl.yml` until it reaches the Git root, so commands work from nested project folders.

## Environment files

```bash
# Print the remote environment file
lctl env pull --server <server-id> --site <site-id>

# Save it locally
lctl env pull --output .env.production

# Preview changes and confirm before writing
lctl env push --file .env.production
```

`env push` shows a redacted diff. In CI, pass `--ci` only when the pipeline is intentionally authorized to update remote environment values.

## Site and server logs

```bash
# Discover available site logs
lctl logs --site <site-id> --server <server-id>

# Tail a selected log
lctl logs --site <site-id> --type laravel --lines 100
lctl logs --site <site-id> --type laravel --follow

# Discover server logs instead
lctl logs --server <server-id>
```

Error and warning lines receive terminal-aware color while output remains readable without ANSI support.

## Certificates

```bash
lctl ssl list --server <server-id>
lctl ssl list --server <server-id> --site <site-id> --json
```

Certificate creation, renewal, and newer DNS workflows are available through their authenticated API paths:

```bash
lctl api GET '/api/servers/<server-id>/sites/<site-id>/certificates'
```

## Deploy and run

```bash
lctl deploy trigger <site-id> --server <server-id>
lctl run "php artisan about" --server <server-id> --site <site-id>
```

See [Deployment commands](/docs/cli/deployments) for live output, history, rollback, and CI waiting.
