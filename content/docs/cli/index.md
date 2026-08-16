---
title: CLI Reference
description: Operate launchctl from a fast, resilient terminal interface
---

`lctl` gives you typed commands for daily operations, full-screen terminal views for live work, and an authenticated API command for every backend feature. It works in a local terminal, over SSH, and inside tmux.

## Install

### Homebrew

```bash
brew tap kkz6/tap
brew install lctl
```

### Go

```bash
go install github.com/kkz6/launchctl@latest
```

Release archives for macOS and Linux on AMD64 and ARM64 are also published from the [CLI repository](https://github.com/kkz6/launchctl-cli/releases).

Verify the install:

```bash
lctl version
lctl completion zsh > "${fpath[1]}/_lctl"
```

## Authenticate

Create a personal API token in the launchctl dashboard, then run:

```bash
lctl login
lctl whoami
```

Login validates the token, handles two-factor verification when enabled, and stores credentials with the active team in `~/.config/launchctl/config.json`.

## First workflow

```bash
# Inspect the account
lctl servers list

# Bind this repository to a server and site
lctl init

# Trigger a deploy; the terminal follows progress and task output
lctl deploy trigger <site-id>

# Open the live team event console
lctl events
```

Once `lctl init` creates `.launchctl.yml`, commands that accept `--server` and `--site` can resolve those values from the current project.

## Core operations

:::card-group
::doc-card{title="Servers" to="/docs/cli/servers"}
Inspect, reboot, connect, measure, and watch provisioning
::
::doc-card{title="Sites" to="/docs/cli/sites"}
Resolve projects, environment files, logs, services, and certificates
::
::doc-card{title="Deployments" to="/docs/cli/deployments"}
Deploy, stream output, inspect history, and roll back
::
::doc-card{title="Live operations" to="/docs/cli/realtime"}
WebSocket events, task consoles, dashboards, and tmux workflows
::
::doc-card{title="Operations" to="/docs/cli/operations"}
Databases, SSH keys, firewall, cron, daemons, and services
::
:::

## Live, automation, and AI

:::card-group
::doc-card{title="Automation" to="/docs/cli/automation"}
Profiles, CI, JSON, project config, and raw API access
::
::doc-card{title="AI Skill" to="/docs/cli/ai-skill"}
Install the Codex skill and operate every CLI and API feature with AI
::
:::

## Global flags

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-readable output; live commands emit NDJSON |
| `--ci` | Disable interactive workflows for CI/CD |
| `--profile <name>` | Use a profile for this invocation without switching globally |
| `--api-url <origin>` | Override the API origin for approved development or staging use |
| `--help` | Show command-specific syntax and flags |

## Configuration precedence

`--api-url` has the highest priority, followed by `LAUNCHCTL_API_URL`, the active profile, and finally `https://launchctl.io`. Normal users should leave the origin unset because launchctl is currently hosted-only. Authentication can be supplied by `LAUNCHCTL_TOKEN` and `LAUNCHCTL_TEAM_ID` in CI.

```bash
LAUNCHCTL_TOKEN="$TOKEN" \
LAUNCHCTL_TEAM_ID="$TEAM_ID" \
lctl servers list --json --ci
```

## Interactive dashboard

Run `lctl` without a command for the navigation interface, or open the live overview directly:

```bash
lctl status
```

The dashboard updates from WebSocket events immediately and performs a REST reconciliation every 30 seconds. Press `r` to refresh and `q` to quit.
