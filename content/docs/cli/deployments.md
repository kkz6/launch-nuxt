---
title: Deployment Commands
description: CLI commands for deployments
---

Trigger and monitor deployments from the command line.

::callout{type="info"}
CLI commands are currently in development. Syntax may change.
::

## Deploy Site
```bash
lctl deploy <site>
```

### Options

| Option | Description |
|--------|-------------|
| `--branch <branch>` | Branch to deploy |
| `--commit <sha>` | Specific commit |
| `--wait` | Wait for completion |
| `--follow` | Follow deployment logs |

### Examples

```bash
# Deploy default branch
lctl deploy example.com

# Deploy specific branch
lctl deploy example.com --branch staging

# Deploy and follow logs
lctl deploy example.com --follow
```

## List Deployments
```bash
lctl deployments <site>
```

### Options

| Option | Description |
|--------|-------------|
| `--limit <n>` | Number of deployments |
| `--status <status>` | Filter by status |

### Example Output

```
ID    COMMIT   BRANCH   STATUS     STARTED              DURATION
5     abc123   main     finished   2024-01-15 10:30    2m 15s
4     def456   main     finished   2024-01-14 15:20    1m 45s
3     ghi789   main     failed     2024-01-14 10:00    0m 30s
```

## View Deployment
```bash
lctl deployments:show <deployment-id>
```

### Output

```
Deployment #5
Site: example.com
Commit: abc123 (Fix login bug)
Branch: main
Status: finished
Started: 2024-01-15 10:30:00
Finished: 2024-01-15 10:32:15
Duration: 2m 15s
```

## Deployment Logs
```bash
lctl logs <site>
```

### Options

| Option | Description |
|--------|-------------|
| `--deployment <id>` | Specific deployment |
| `--follow` | Stream live logs |
| `--tail <n>` | Last n lines |

### Examples

```bash
# Latest deployment logs
lctl logs example.com

# Specific deployment
lctl logs example.com --deployment 5

# Follow live
lctl logs example.com --follow
```

## Rollback
```bash
lctl rollback <site>
```

Rolls back to the previous successful deployment.

### Options

| Option | Description |
|--------|-------------|
| `--deployment <id>` | Rollback to specific deployment |
| `--force` | Skip confirmation |

### Example

```bash
# Rollback to previous
lctl rollback example.com

# Rollback to specific deployment
lctl rollback example.com --deployment 3
```

## CI/CD Integration
### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to launchctl
        run: |
          npm install -g @launchctl/cli
          lctl deploy example.com --wait
        env:
          LAUNCH_TOKEN: ${{ secrets.LAUNCH_TOKEN }}
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - npm install -g @launchctl/cli
    - lctl deploy example.com --wait
  only:
    - main
  variables:
    LAUNCH_TOKEN: $LAUNCH_TOKEN
```
