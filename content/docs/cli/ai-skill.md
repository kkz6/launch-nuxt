---
title: AI Skill
description: Install and maintain the operate-launchctl guide bundled with lctl
---

The `operate-launchctl` skill is bundled with the CLI and also distributed as
part of the launchctl plugin. Choose one installation method to avoid duplicates.

```bash
lctl ai install
lctl ai doctor
lctl ai update
```

The standalone location is `$CODEX_HOME/skills/operate-launchctl`, or
`~/.codex/skills/operate-launchctl` by default. Update the CLI first, then use
`lctl ai update` to install its matching guidance. The manager checks file hashes
and refuses to overwrite local changes without `--force`. Unmanaged directories
are never replaced. `lctl ai uninstall` removes a managed copy.

All four commands support `--json` and `--codex-home`. Repository plugin users
should update their plugin to a release containing the same CLI commands instead
of installing a second standalone copy.

## Install the repository plugin

If you have access to the source repository, the plugin is versioned with the
CLI release:

```bash
codex plugin marketplace add kkz6/launchctl-cli --ref v0.4.1
codex plugin add launchctl@launchctl
```

Use one installation method. Update the marketplace to a newer release tag
before updating the plugin.

## What the skill covers

The guide prefers dedicated server/site, native deployment, Docker project,
application and Compose commands. It uses confirmed raw API routes for gaps
listed in [Feature coverage](/docs/cli/feature-coverage). It does not invent
commands or treat a queued response as completed work.

For browser sign-in, it can start `lctl auth`, but the user enters the displayed
code and approves in their browser. The skill must not approve its own device
request or retrieve a sign-in credential from browser storage.

It distinguishes Compose deployment completion from workload health, preserves
named volumes unless removal was requested, and keeps secrets out of responses.
The command reference and bundled examples are checked against the actual CLI
command tree during validation.

## Progress and verification

Follow Docker application progress with the event stream:

```bash
lctl events --filter 'docker.application.*' --filter 'deployment.gha_steps'
```

A queued HTTP response confirms acceptance, not completion. In a terminal or
tmux, keep the event stream in a separate pane. In automation, `--json` emits
NDJSON; use supported `--wait` commands or reconcile the final application and
deployment state through the API. See [Docker commands](/docs/cli/docker) and
[Feature coverage](/docs/cli/feature-coverage) for the available flows.
