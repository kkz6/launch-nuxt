---
title: Automation and API Access
description: Profiles, project defaults, JSON output, CI credentials, and complete API coverage
---

## Profiles

Profiles keep API origin, token, team, user, and favorites together.

```bash
lctl config profiles
lctl config profiles add staging
lctl config profiles use staging
lctl switch production
lctl --profile staging servers list
```

Use one profile per hosted, staging, or self-hosted account.

```bash
lctl config set api_url https://launch.example.com
lctl config show
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `LAUNCHCTL_TOKEN` | Personal API token |
| `LAUNCHCTL_TEAM_ID` | Active team ID |
| `LAUNCHCTL_API_URL` | Hosted or self-hosted API origin |

Flags override environment variables; environment variables override the active profile.

## JSON and CI

```bash
lctl servers list --json --ci
lctl sites list --server "$SERVER_ID" --json --ci
lctl tasks list --server "$SERVER_ID" --json --ci
```

Live commands emit newline-delimited JSON:

```bash
lctl events --filter 'task.*' --json --ci
```

## Project defaults

`lctl init` writes `.launchctl.yml` with server and site IDs. Commit it when every contributor should target the same launchctl project; otherwise add it to `.gitignore`.

## Call any API endpoint

```bash
lctl api GET /api/servers
lctl api GET /api/servers/<server-id>/docker/projects
lctl api POST /api/scripts --data '{"name":"health-check"}'
lctl api PUT /api/settings/notification-preferences --data @settings.json
```

`lctl api` applies the active bearer token, `X-Team-ID`, API origin, retries for safe reads, response limits, and typed API errors. The path must begin with `/api`.

::callout{type="warning"}
Raw `POST`, `PUT`, `PATCH`, and `DELETE` calls can change infrastructure. Prefer a high-level command when one exists and inspect the endpoint contract before automating a mutation.
::

## Self-hosted endpoint

```bash
lctl --api-url https://launch.example.com whoami
LAUNCHCTL_API_URL=https://launch.example.com lctl status
```

The same origin is transformed to `wss://` for terminal and pub/sub connections. Origins ending in `/api` are normalized without duplicating the path.

## Pipeline example

```yaml
- name: Install lctl
  run: brew install kkz6/tap/lctl

- name: Deploy and wait
  env:
    LAUNCHCTL_TOKEN: ${{ secrets.LAUNCHCTL_TOKEN }}
    LAUNCHCTL_TEAM_ID: ${{ secrets.LAUNCHCTL_TEAM_ID }}
  run: >-
    lctl deploy trigger "$SITE_ID"
    --server "$SERVER_ID"
    --ci --wait --timeout 600
```
