---
title: AI Skill
description: Install the operate-launchctl Codex skill and use AI to manage launchctl safely
---

The `operate-launchctl` skill teaches Codex how to use `lctl`, select the safest command or API endpoint, follow WebSocket progress, and verify asynchronous work before reporting success. It covers servers, sites, Docker workloads, deployments, tasks, databases, services, DNS, backups, scripts, and other launchctl resources.

## Choose one installation method

Install either the standalone skill bundled with `lctl` or the repository plugin. Do not install both, because Codex would discover the same skill twice.

### Install with the CLI

This method works offline after the CLI has been installed:

```bash
lctl ai install
lctl ai doctor
```

The skill is installed at `$CODEX_HOME/skills/operate-launchctl`, or `~/.codex/skills/operate-launchctl` when `CODEX_HOME` is not set.

After upgrading the CLI, update the embedded skill:

```bash
lctl ai update
```

The manager hashes every installed file. It refuses to overwrite local changes unless you explicitly use `lctl ai update --force`, and it never replaces or removes an unmanaged directory.

Remove only the CLI-managed copy with:

```bash
lctl ai uninstall
```

All four commands support the global `--json` flag. Use `--codex-home <path>` when Codex uses a non-default home directory.

### Install the repository plugin

The plugin is versioned with the CLI release:

```bash
codex plugin marketplace add kkz6/launchctl-cli --ref v0.2.3
codex plugin add launchctl@launchctl
```

Start a new Codex task if the skill does not appear in an already-open task. Update the marketplace to a newer release tag before updating the plugin.

## Use the skill

Invoke the skill explicitly with `$operate-launchctl`, or ask naturally about launchctl infrastructure. Useful requests include:

```text
Use $operate-launchctl to diagnose my latest failed site deployment.
Use $operate-launchctl to deploy the api application in my Docker project and follow it until it finishes.
Use $operate-launchctl to show failed tasks without exposing any secrets.
Use $operate-launchctl to watch Docker application events in tmux.
```

Codex begins with read-only discovery, resolves names to immutable IDs, uses typed commands when available, and falls back to `lctl api` for newer backend resources such as Docker applications.

## Docker application operations

The current CLI exposes Docker resources through its authenticated raw API client:

```bash
lctl api GET /api/servers/<server-id>/docker/projects
lctl api GET /api/servers/<server-id>/docker/projects/<project-id>/applications
lctl api POST /api/servers/<server-id>/docker/projects/<project-id>/applications/<application-id>/deploy
```

The skill knows the supported payload shapes, lifecycle endpoints, deployment statuses, GitHub Actions flow, and Docker-specific events. See [Docker Applications](/docs/application/docker/applications) for the dashboard workflow and [Docker Applications API](/docs/api/docker-applications) for endpoints and examples.

## Progress and verification

For long-running work, the skill follows WebSocket events instead of treating a queued HTTP response as completion:

```bash
lctl events --filter 'docker.application.*' --filter 'deployment.gha_steps'
```

In an interactive terminal or tmux, keep the event stream in a separate pane. In automation, use `--json` for newline-delimited JSON and reconcile the final application and deployment state through `lctl api GET`.

## Safety model

- Credentials come from the active `lctl` profile or CI environment and are never printed.
- Secret values, registry passwords, private keys, and raw environment values stay redacted.
- Mutations target resolved server, project, application, and deployment IDs.
- Docker deletion preserves named volumes unless removal is explicitly requested.
- A queued deployment, lifecycle action, or GitHub Actions synchronization is not reported as successful until its final state is verified.
