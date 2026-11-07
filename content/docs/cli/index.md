---
title: CLI Reference
description: Install lctl, sign in through your browser, and manage launchctl
---

`lctl` manages launchctl servers, sites, Docker workloads and deployments.
This reference follows the current source.
Check `lctl version` and `lctl <command> --help` against your installed release.

## Install and update

```bash
brew install kkz6/tap/lctl
lctl version
lctl update --check
lctl update
```

Published archives support macOS and Linux on AMD64 and ARM64. Contributors
can build a source checkout with `go build -o bin/lctl .`.
Homebrew installations update through Homebrew; direct binary updates verify
checksums before replacement. `lctl upgrade` is an alias for `lctl update`.

If Homebrew reports an untrusted tap, trust only this formula and retry:

```bash
brew trust --formula kkz6/tap/lctl
brew install kkz6/tap/lctl
```

Use `lctl update --force` to reinstall the latest release. Passive update notices
use a local cache and refresh in the background, at most once every 24 hours
after a successful check or once per hour after a failure. Disable these checks
and notices with `LAUNCHCTL_NO_UPDATE_CHECK=1`; explicit update commands remain
available. After updating the binary, run `lctl ai update` if it manages your
standalone skill.

## Sign in through your browser

```bash
lctl auth
```

The CLI displays an eight-digit one-time code and opens the approval page.
Sign in to launchctl, paste the code from your terminal, and choose **Approve**.
If your account uses two-factor authentication, provide the requested second
factor. Return to the terminal when approval succeeds. You do not need to
create or paste a personal API token.

`lctl login` and `lctl auth login` use the same browser flow. On a machine without
a browser, use `lctl auth --no-browser` and open the printed URL on another
trusted device. Codes expire after ten minutes and can be used once. A denied
or expired attempt leaves the previous local sign-in unchanged.

```bash
lctl whoami --json
lctl auth status
lctl logout
```

Browser sign-in requires the matching API and web release with device
approval support. It cannot work against an older server lacking those routes.
`--ci` does not perform browser approval; see [Automation](/docs/cli/automation)
for unattended credentials.

## Manage resources

- [Servers](/docs/cli/servers): create, update, recover, archive, watch and reboot.
- [Sites](/docs/cli/sites): create, update, auto-deploy and delete.
- [Deployments](/docs/cli/deployments): deploy, wait, roll back and inspect logs.
- [Docker](/docs/cli/docker): projects, applications and Compose stacks.
- [Operations](/docs/cli/operations): services, databases, keys and scheduled work.
- [Command index](/docs/cli/command-index): all registered commands and flags.
- [Feature coverage](/docs/cli/feature-coverage): dedicated commands and remaining gaps.

## Live, automation, and AI

- [Live operations](/docs/cli/realtime): events, task output and dashboards.
- [Automation](/docs/cli/automation): profiles, unattended credentials and raw API access.
- [AI skill](/docs/cli/ai-skill): install and update the bundled operating guide.

## Configuration

Configuration is stored in `~/.config/launchctl/config.json`; successful browser
sign-in saves the active profile with owner-only permissions. `.launchctl.yml`
holds project defaults created by `lctl init`.

Global flags are `--json`, `--ci`, `--profile`, `--api-url` and `--help`.
Not every older command supports noninteractive or JSON behavior; consult the
workflow page and coverage notes. Use `lctl version`, not a `--version` flag.
The default API origin is `https://api.launchctl.io`.

launchctl is currently hosted-only. The CLI connects to the hosted control plane;
changing the API origin does not install a self-hosted control plane.
