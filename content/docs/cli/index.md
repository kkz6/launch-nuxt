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
brew tap launch/tap
brew install launch-cli
```

### Linux

```bash
curl -fsSL https://cli.launch.dev/install.sh | bash
```

### Windows

```powershell
scoop bucket add launch https://github.com/launch/scoop-bucket
scoop install launch-cli
```

### NPM

```bash
npm install -g @launch/cli
```

## Authentication
### Login

```bash
launch login
```

This opens your browser to authenticate with launchctl.

### Using API Token

```bash
launch login --token YOUR_API_TOKEN
```

### Check Authentication

```bash
launch whoami
```

## Quick Start
```bash
# Login to launchctl
launch login

# List your servers
launch servers

# List sites on a server
launch sites --server production

# Deploy a site
launch deploy --site example.com

# View deployment logs
launch logs --site example.com
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

The CLI stores configuration in `~/.launch/config.json`:

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
launch completion bash > /etc/bash_completion.d/launch
```

### Zsh

```bash
launch completion zsh > ~/.zsh/completions/_launch
```

### Fish

```bash
launch completion fish > ~/.config/fish/completions/launch.fish
```

## Examples
### Deploy on Git Push

Add to your CI/CD pipeline:

```yaml
# GitHub Actions
- name: Deploy to launchctl
  run: |
    launch deploy --site ${{ secrets.SITE_ID }}
  env:
    LAUNCH_TOKEN: ${{ secrets.LAUNCH_TOKEN }}
```

### Quick SSH Access

```bash
# Connect to server
launch ssh production

# Run a command
launch ssh production -- php artisan migrate
```

### Tail Logs

```bash
# View live logs
launch logs --site example.com --follow

# View deployment output
launch logs --deployment 123
```

## Troubleshooting
### Command Not Found

Ensure the CLI is in your PATH:

```bash
which launch
```

### Authentication Failed

Re-authenticate:

```bash
launch logout
launch login
```

### Connection Issues

Check your network and API status:

```bash
launch status
```
