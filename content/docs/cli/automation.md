---
title: Automation and API Access
description: Profiles, project context, JSON output and authenticated API requests
---

## Profiles and defaults

```bash
lctl config profiles
lctl config profiles add staging
lctl --profile staging auth
lctl --profile staging servers list --json
lctl init
```

Use profiles for separate accounts or approved development environments.
`lctl init` records server/site or Docker project/application IDs in
`.launchctl.yml`. Compose commands require an explicit stack ID.

## Unattended use

Browser approval is for a person signing in. Existing machine credentials remain
supported for pipelines through `LAUNCHCTL_TOKEN` and `LAUNCHCTL_TEAM_ID`; store
them in the CI secret manager, not command arguments or source control.

```bash
lctl servers list --json --ci
lctl deploy trigger "$SITE_ID" --server "$SERVER_ID" --wait --timeout 600 --json --ci
```

`--json` formats supported outputs; event and log-follow streams use NDJSON.
`--ci` is not authorization to destroy data. New destructive commands require
`--yes`, and some older command groups still prompt or produce plain output.
See [Feature coverage](/docs/cli/feature-coverage).

The default API is `https://api.launchctl.io`. `--api-url` overrides
`LAUNCHCTL_API_URL`, then the profile/default. An override selects an approved
API origin; it is not a self-hosting interface. launchctl is currently a hosted service.
`LAUNCHCTL_NO_UPDATE_CHECK=1` disables passive update checks.

## Raw API bridge

```bash
lctl api GET /api/servers
lctl api GET /api/servers/<server-id>/backups
lctl api GET /api/scripts
lctl api PUT /api/settings/notification-preferences --data @settings.json
```

The CLI accepts historical `/api`-prefixed paths and removes that prefix for the
current root-mounted API. It supplies authentication and `X-Team-ID`.
Request data must be JSON. Safe reads retry transient failures; mutations are
not replayed automatically. Multipart upload, browser authentication ceremonies
and WebSocket sessions are not covered by an arbitrary JSON request.
