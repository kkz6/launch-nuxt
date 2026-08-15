---
title: Deployment Commands
description: Trigger deployments, follow task output, inspect history, and roll back
---

## Trigger a deployment

```bash
lctl deploy trigger <site-id> --server <server-id>
```
Interactive terminals open a full-screen deployment view. It follows team deployment events, filters them by the exact `deployment_id`, discovers the backing task, and streams task output. Press `q` to leave it running in the background.

For a pipeline, use a bounded wait:

```bash
lctl deploy trigger <site-id> \
  --server <server-id> \
  --ci --wait --timeout 600
```

The command returns non-zero for failed deployments or timeouts.

## History and details

```bash
lctl deploy list <site-id> --server <server-id>
lctl deploy show <deployment-id> \
  --server <server-id> \
  --site <site-id>
```

Add `--json` for machine-readable deployment records, commit data, task IDs, and timestamps.

## Logs

Show stored output for the latest deployment:

```bash
lctl deploy logs <site-id> --server <server-id>
```

Choose a deployment or follow an active one:

```bash
lctl deploy logs <site-id> <deployment-id> --server <server-id>
lctl deploy logs <site-id> <deployment-id> --server <server-id> --follow
```

Live output survives transient API restarts: the event connection reconnects, restores subscriptions, and retains the deployment filter. REST polling is used to discover the task record and stored task output remains available after completion.

## Roll back

```bash
lctl deploy rollback <deployment-id> \
  --server <server-id> \
  --site <site-id>
```

The CLI displays the selected commit and asks for confirmation before creating the rollback deployment.

## Observe every deployment

```bash
lctl events --filter 'deployment.*'
lctl events --filter 'deployment.*' --json
```

This is useful in a dedicated tmux pane while another pane triggers deployments or runs remote commands.

## GitHub Actions example

```yaml
- name: Deploy
  env:
    LAUNCHCTL_TOKEN: ${{ secrets.LAUNCHCTL_TOKEN }}
    LAUNCHCTL_TEAM_ID: ${{ secrets.LAUNCHCTL_TEAM_ID }}
  run: |
    lctl deploy trigger "$SITE_ID" \
      --server "$SERVER_ID" \
      --ci --wait --timeout 600
```
