---
title: CLI Reference
description: launchctl command-line interface for server management
---

The launchctl CLI provides command-line access to manage your servers, sites, and deployments directly from your terminal.

::callout{type="info"}
The launchctl CLI is currently in development. This documentation will be updated as features are released.
::

## Installation
### macOS

```bash
brew tap launchctl/tap
brew install lctl
```

### Linux

```bash
curl -fsSL https://cli.launchctl.io/install.sh | bash
```

### Windows

```powershell
scoop bucket add launchctl https://github.com/launchctl/scoop-bucket
scoop install lctl
```

### NPM

```bash
npm install -g @launchctl/cli
```

## Authentication
### Login

```bash
lctl login
```

This opens your browser to authenticate with launchctl.

### Using API Token

```bash
lctl login --token YOUR_API_TOKEN
```

### Check Authentication

```bash
lctl whoami
```

## Quick Start
```bash
# Login to launchctl
lctl login

# List your servers
lctl servers

# List sites on a server
lctl sites --server production

# Deploy a site
lctl deploy --site example.com

# View deployment logs
lctl logs --site example.com
```

## Available Commands
:::card-group
::doc-card{title="Servers" to="/docs/cli/servers"}
Manage servers from the command line
::
::doc-card{title="Sites" to="/docs/cli/sites"}
Create and manage sites
::
::doc-card{title="Deployments" to="/docs/cli/deployments"}
Trigger and monitor deployments
::
::doc-card{title="SSH" to="/docs/cli/ssh"}
Connect to servers via SSH
::
:::

## Global Options
| Option | Description |
|--------|-------------|
| `--help` | Show help for a command |
| `--version` | Show CLI version |
| `--team <name>` | Specify team context |
| `--json` | Output in JSON format |
| `--quiet` | Suppress non-essential output |

## Configuration
### Config File

The CLI stores configuration in `~/.lctl/config.json`:

```json
{
  "token": "your-api-token",
  "team": "default-team",
  "defaults": {
    "server": "production"
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LAUNCH_TOKEN` | API token for authentication |
| `LAUNCH_TEAM` | Default team |
| `LAUNCH_API_URL` | API endpoint (for self-hosted) |

## Shell Completion
### Bash

```bash
lctl completion bash > /etc/bash_completion.d/lctl
```

### Zsh

```bash
lctl completion zsh > ~/.zsh/completions/_lctl
```

### Fish

```bash
lctl completion fish > ~/.config/fish/completions/lctl.fish
```

## Examples
### Deploy on Git Push

Add to your CI/CD pipeline:

```yaml
# GitHub Actions
- name: Deploy to launchctl
  run: |
    lctl deploy --site ${{ secrets.SITE_ID }}
  env:
    LAUNCH_TOKEN: ${{ secrets.LAUNCH_TOKEN }}
```

### Quick SSH Access

```bash
# Connect to server
lctl ssh production

# Run a command
lctl ssh production -- php artisan migrate
```

### Tail Logs

```bash
# View live logs
lctl logs --site example.com --follow

# View deployment output
lctl logs --deployment 123
```

## Troubleshooting
### Command Not Found

Ensure the CLI is in your PATH:

```bash
which lctl
```

### Authentication Failed

Re-authenticate:

```bash
lctl logout
lctl login
```

### Connection Issues

Check your network and API status:

```bash
lctl status
```
