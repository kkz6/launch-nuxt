---
title: CLI Reference
description: Operate launchctl from a fast, resilient terminal interface
---

`lctl` gives you typed commands for daily operations, full-screen terminal views for live work, and an authenticated API command for every backend feature. It works in a local terminal, over SSH, and inside tmux.

## Install

### Homebrew

```bash
brew install kkz6/tap/lctl
```

The fully qualified formula grants trust only to `lctl`. If Homebrew reports
that a previously added tap is untrusted, trust the formula and retry:

```bash
brew trust --formula kkz6/tap/lctl
brew install kkz6/tap/lctl
```

### Source checkout

Repository contributors with source access can run `go build -o lctl .`. The
source repository is private, so its Go module is not a public installation
channel. Published binaries support macOS and Linux on AMD64 and ARM64.

Verify the install:

```bash
lctl version
lctl completion zsh > "${fpath[1]}/_lctl"
```

## Update lctl

Check without changing the installation, or install the latest stable release:

```bash
lctl update --check
lctl update
```

For scripts, `lctl update --check --json` reports the current and latest
versions plus `update_available`. Homebrew installations delegate to
`brew upgrade kkz6/tap/lctl`; direct installations verify the downloaded
archive and staged binary before an atomic replacement. `lctl upgrade` is an
alias, and `lctl update --force` reinstalls the latest release.

The interactive header can show `Update available: vX.Y.Z`. It reads a local
cache immediately and refreshes it in a detached process, so launch does not
wait on the network. Successful checks run at most once every 24 hours and
failed checks retry after one hour. Disable only these passive checks and
notices with:

```bash
export LAUNCHCTL_NO_UPDATE_CHECK=1
```

Explicit update commands remain available. If the CLI manages your
`operate-launchctl` skill, run `lctl ai update` after updating the binary.

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

| Flag                 | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `--json`             | Machine-readable output; live commands emit NDJSON              |
| `--ci`               | Disable interactive workflows for CI/CD                         |
| `--profile <name>`   | Use a profile for this invocation without switching globally    |
| `--api-url <origin>` | Override the API origin for approved development or staging use |
| `--help`             | Show command-specific syntax and flags                          |

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
