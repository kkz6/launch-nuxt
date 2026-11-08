---
title: Feature coverage
description: Source audit of dedicated CLI commands, raw API access, browser flows, and remaining automation gaps.
---

`lctl` covers common server, site, deployment, and Docker operations. It does **not** have dedicated commands for every launchctl feature. The authenticated `lctl api` command makes many remaining JSON endpoints callable, but does not provide their forms, validation, confirmations, progress tracking, or complete workflows.

This audit covers all 16 backend modules and the registered CLI command tree as of **2026-11-07**. It includes server/site management, Compose, deployment reliability, and browser authentication additions. Availability in an installed release or hosted environment must be checked separately.

## How to read this page

- **Dedicated** means a registered CLI command calls the feature. It does not imply every backend field or action is exposed.
- **Raw API** means an authenticated JSON request can be constructed with `lctl api`; the caller must supply the correct method, IDs, query, and body. Permissions, team scope, subscriptions, and server readiness still apply.
- **Specialized** means a browser, WebSocket client, external provider, or signed callback is required. The generic JSON command does not complete that flow.
- **Missing** means no dedicated CLI command exists for the listed operation. A backend feature is not classified as unavailable merely because it lacks a command.

Paths below are the **actual Go backend paths**, normally relative to the API host root. For `lctl api`, prepend `/api`:

```bash
# Calls GET https://api.launchctl.io/servers
lctl api GET /api/servers

# Calls the server-scoped backup listing; replace SERVER_ID with its ID.
lctl api GET /api/servers/SERVER_ID/backups
```

The CLI accepts the historical `/api` prefix and removes it at the transport boundary. An explicitly configured base URL ending in `/api` retains that base prefix for older development deployments. Docker GitHub Actions callbacks are a separate exception: their backend paths literally start with `/api/webhooks/docker/` and use workload credentials, not ordinary team authentication.

The raw command sends JSON only (`--data` or `--data @file.json`), returns the response body, and rejects non-2xx HTTP responses. It requires existing CLI authentication even when a destination endpoint is public. It does not support multipart uploads, arbitrary request headers, WebSocket upgrades, interactive identity challenges, automatic pagination, or polling an asynchronous operation to completion. Responses are not automatically redacted. A successful request is not proof that a remote job finished.

## Accounts, teams, and platform

| Backend module / resource | Dedicated CLI coverage | Remaining access and limits |
| --- | --- | --- |
| API health: `/health` | No dedicated health command. | Raw API can read the liveness response. This is API availability, not the health of every managed server or workload. |
| Authentication and identity: `/auth/user`, `/auth/token`, `/auth/logout` | `auth`, `auth login`, and `login` use browser approval; `auth status`, `whoami`, and `logout` inspect or clear identity. | Browser login uses the new `/auth/device/code` and `/auth/device/token` endpoints plus the web `/cli/auth` page. It requires the matching backend and frontend additions. `--no-browser` prints the approval URL; it still needs a person to approve. `--ci` is rejected for this flow. |
| Account/profile settings: `/auth/profile`, `/auth/locale`, `/auth/password`, `/auth/account`, `/auth/reset-onboarding` | No account-editing commands. | Raw API for authenticated JSON settings. Registration, password reset, email verification, invitation acceptance, and login challenges remain specialized identity workflows; a request to one endpoint does not implement their full flow. |
| Two-factor authentication: `/auth/two-factor/*` | Browser login delegates account authentication to the web application. | Raw API can call authenticated enable/confirm/disable and recovery-code endpoints with their required inputs. No dedicated setup or recovery workflow. |
| Passkeys: `/user/passkeys/*`, `/auth/passkey/login/*` | No dedicated passkey commands. | Listing, renaming, and deleting saved passkeys are JSON operations. Registration and authentication require a browser/authenticator ceremony. |
| Personal tokens and sessions: `/user/tokens`, `/user/sessions` | Credentials are stored by browser login; no token/session management command group. | Raw API for listing, issuing/revoking tokens and inspecting/revoking sessions, subject to the endpoint's authentication requirements. `logout` clears local credentials; it is not a bulk token/session revocation command. |
| Teams and membership: `/teams`, `/auth/teams`, `/auth/current-team` | `teams list`, `teams members`, interactive `teams switch`. | Team creation/update/deletion, invitations/resends/cancellation, member role changes/removal, and noninteractive switching lack dedicated commands. Use the authenticated JSON routes or the web application. |
| Dashboard/onboarding: `/dashboard`, `/actions/active`, `/onboarding/status`, `/onboarding/complete` | `status` opens a dashboard TUI. | Raw API for dashboard data, active actions, and onboarding. `status` is not a JSON dashboard command. |
| Billing: `/billing/*`, `/register/subscription` | None. | Raw API for plans, subscriptions, orders, options, checkout URL creation, cancellation, and resumption. Checkout/payment and redirect completion need the browser/payment provider. |
| Notifications: `/settings/notifications`, `/settings/notification-preferences`, `/notification-channels` | None. | Raw API for channel CRUD, test/default/disconnect/reconnect actions, preference updates, and supported channel types. No dedicated notification command group. |
| Reusable scripts: `/scripts`, `/scripts/:id/execute`, `/scripts/:id/executions`, `/script-executions/:id` | None for the reusable script library. | Raw API for script CRUD, execution requests, and history. `lctl run` executes a site command and does not manage this script library. Live script execution is a separate WebSocket flow. |
| Platform updates: `/platform/updates` | None. | Raw API for list/show/run/run-all/dismiss. `lctl update` updates the local CLI binary; it does not run backend platform updates on servers. |
| Staff administration: `/admin/*` | None. | Raw API for authorized staff overview, observability, users/teams/servers, failure logs, plans, invitations, and allowed administrative actions. Staff role gates still apply. `DELETE /admin/servers/:id` requires `super_admin` and an exact `confirmation_name`; see [server deletion](/docs/application/servers#delete-server). `/admin/{users,servers,failures,invitations}/table` also exposes metadata/data, actions, and saved views. These are not customer team-management features. |

## Servers and native sites

In this table, `S` denotes `/servers/:serverId` and `W` denotes `/servers/:serverId/sites/:siteId`. These are path abbreviations, not literal route segments.

| Backend module / resource | Dedicated CLI coverage | Missing commands / raw API coverage |
| --- | --- | --- |
| Server inventory and lifecycle: `/servers`, `/servers/create-options`, `S` | `servers list`, `show`, `create-options`, `create`, `update`, `reboot`, `retry-provision`, `try-connection`, `archive`, `unarchive`. Creation supports custom and connected cloud providers. | No dedicated server delete or archived-list command. Raw API also exposes `S/page`, `S/site-count`, `S/connect`, `S/detect-os`, and `S/vulnerability-audit`. Updates expose selected settings, not the full server DTO. Provisioning/reboot requests are asynchronous. |
| Cloud-provider connections: `/server-providers` | `servers create` can reference an existing provider credential. | Provider list/connect/delete require raw API or the web application. The CLI does not obtain cloud-provider credentials. |
| Provisioning: `S/provision-status`, `S/provision-script-content` | `servers show`, `servers watch`, retry/connection actions. | Raw API for detailed provisioning state and script content. Custom-server registration does not itself prepare the remote machine. Executing the signed bootstrap script remains an explicit server setup step. |
| Services: `S/services`, `S/agent-version` | `services list`, `start`, `stop`, `restart`. | Raw API for available-service catalogue, installation, other service operations, and agent version. Existing operation commands have the response-handling caveat below. |
| PHP and Composer: `S/php`, `S/php-versions`, `S/packages` | Site creation/update can select an installed PHP version. | PHP installation/default selection/patching, OPcache defaults/status/reset/configuration, extensions, PHP configuration editing, and Composer authentication require raw API or the web application. |
| Firewall: `S/firewall-rules` | `firewall list`, interactive `add`, interactive `delete`. | Rule updates use raw API. Existing mutation commands are not fully automation-ready. |
| Scheduled jobs: `S/crons` | `cron list`, interactive `add`, interactive `delete`. | Cron updates use raw API. Existing mutation commands are not fully automation-ready. |
| Daemons: `S/daemons` | `daemons list`, interactive `add`, `restart`, interactive `delete`. | Update and status synchronization use raw API. Existing mutation commands have the response-handling caveat below. |
| SSH keys: `/ssh-keys`, `S/ssh-keys` | `ssh-keys list`, `add`, `delete`, `server-list`, `attach`, `detach`. | Key generation is raw API (`POST /ssh-keys/generate`). Existing delete/attach/detach behavior has the response-handling caveat below. |
| Server metrics: `S/metrics`, `S/metrics/latest` | `servers metrics`; `--watch` opens a TUI. | Historical metric queries use raw API. The interactive navigator also uses the specialized metrics stream. |
| Server jobs: `S/tasks`, `S/tasks/latest`, `S/tasks/:taskId` | `tasks list`, `tasks watch`; deployment logs fetch the exact stored task. | Latest/direct task reads are available through raw API. Task watch is an event viewer, not a robust wait command for automation. |
| Server logs: `S/logs`, `S/logs/:log` | `logs` lists sources or prints/polls a selected log. | Raw API can read the available log resources. Selected-log output is text even with `--json`; follow mode has separate limitations below. |
| Load balancers: `S/upstreams`, nested `/backends`, `/health`, `/health-check` | Server creation supports the load-balancer type. | Upstream/backend CRUD, domain checking, backend down toggles, and health checks use raw API. No dedicated load-balancer configuration commands. |
| Site lifecycle: `S/sites`, `W` | `sites list`, `show`, `create`, `update`, `delete`. | Creation covers Laravel, WordPress, static, generic, and phpMyAdmin with documented flags. Updates cover PHP version, web folder, branch, release retention, and deployment queuing. Other settings and `W/deletion-resources` use raw API. Creation/deletion may leave remote jobs running after the command returns. |
| Site catalogues/settings: `/sites/create-options`, `/sites/hook-defaults`, `/sites/verify-domain`, `W/settings`, `W/deployment-settings` | Selected values are exposed in site create/update. | Catalogue/domain checks, deployment hooks and other settings, and `W/deploy-token/regenerate` have no dedicated commands. Raw API exposes the supported DTO fields. |
| Native deployments: `W/deploy`, `W/deployments`, `W/deployments/:deploymentId`, `W/rollback/:deploymentId`, `W/deployments/queued` | `deploy trigger`, `list`, `show`, `rollback`, `cancel-queued`, `logs`. Trigger/rollback have bounded `--wait`; logs can follow with text or NDJSON outside the TUI. | Cancel-queued removes queued deployments only; it does not stop an active deployment. Rollback remains subject to retained release availability and backend validation. Stored task/log data may be absent for attempts that never started. |
| Automatic deployment: `W/autodeploy`, `W/auto-deployment/enable`, `W/auto-deployment/disable` | `sites auto-deploy enable` and `disable`. | The legacy toggle endpoint remains accessible through raw API. Git provider connections/webhooks still need their separate setup. |
| Site queues: `W/queues`, `W/auto-restart-queue` | None. | Queue CRUD, sync/restart, and automatic restart settings use raw API. `daemons` manages server daemons, not site queue records. |
| Site commands: `W/commands` | `run` and `run --history`. | Command-record deletion is raw API. Execution output and completion polling have the legacy caveats below. |
| Redirects and features: `W/redirects`, `W/features/:feature/enable`, `W/features/:feature/disable` | None. | Raw API for redirect CRUD and supported feature toggles. |
| Site files/environment: `W/files`, `W/files/:file`, `W/logs` | `env pull`, `env push`; `logs --site` lists/reads log files. | Other managed file reads/updates use raw API. `env` manages the native site's environment file, not Docker project/application environment variables. |
| Site SSL: `W/ssl`, `W/certificate`, `W/certificate/retry`, `W/certificates` | `ssl list` lists site certificates. | SSL configuration, active certificate checks, and retry require raw API. No dedicated issue/install/renew commands. |
| Stored certificate library: `/certificates`, `/certificates/:id/usages` | None. | Raw API for stored certificate CRUD and usage lookup. This team-wide library is separate from `ssl list`. |
| Native databases: `S/databases`, `S/database-users` | `databases list`, interactive `create`, interactive `delete`, and `databases users` (list only). | Database show/sync and standalone database-user create/show/update/delete use raw API. These are native server databases, not Docker database workloads. |
| Backups/storage: `S/backups`, `/storage-providers` | None. | Raw API for backup CRUD/run and storage provider list/dropdown/show/connect/update/delete. A backup run returns a job receipt. This native backup route family does not expose a restore endpoint. Docker database restore is separate. |

## Docker

`D` denotes `/servers/:serverId/docker`, `P` denotes `D/projects/:projectId`, `A` denotes `P/applications/:applicationId`, `C` denotes `P/composes/:composeId`, and `B` denotes `P/databases/:databaseId`.

| Resource | Dedicated CLI coverage | Missing commands / raw API coverage |
| --- | --- | --- |
| Projects: `D/projects` | `docker projects list`, `show`, `create`, `update`, `delete`. | Project environment-variable CRUD (`P/env-vars`) is raw API only. |
| Single-container applications: `P/applications` | `docker applications list`, `show`, `create`, `update`, `delete`, `deploy`, `reload`, `start`, `stop`, `deployments`. Creation supports image, Git, and inline Dockerfile sources; existing connected registry/source-control IDs can be supplied. | Update flags expose name/build type/Dockerfile path only. Runtime environment CRUD/bulk replace, advanced settings, Traefik configuration, domains/DNS checks/certificates/retry, redirects, build secrets, volumes, and schedules require raw API. |
| Application deployment/GitHub Actions: `A/deploy`, `A/deployments`, `A/gha/*` | Deploy/history commands; Git application creation can select GitHub Actions builds. `deploy --wait` waits for the deployment and subsequent application running state. | Deployment-record deletion, GHA step timelines, token rotation, workflow resync/disable, and GHA auto-deploy toggles lack dedicated commands. A running state is not an application-level health test. |
| Compose: `P/composes` | `docker composes list`, `show`, `create`, `update`, `delete`, `deploy`, `reload`, `deployments`; alias `compose`. | Create accepts a local YAML file only. Git-based creation and registry attachments require raw API. Existing Git stacks can be read/deployed/reloaded. Update supports name, environment file, and command override; **the backend PATCH endpoint cannot replace Compose YAML/source**. |
| Compose configuration/deployments: `C/services`, `C/default-command`, `C/deployments`, `C/gha/*` | `deploy --wait` follows the exact deployment until success/failure/cancellation or timeout. `show --json --show-config` explicitly reveals stored YAML/environment/command content. | Service listing, default-command preview, deployment deletion/GHA steps, GHA controls, build secrets, volumes, domains/DNS/certificates, and Traefik configuration use raw API. Reload is queued without a deployment row, so no reload wait flag exists. Reload applies saved environment using existing images and ignores command overrides. |
| Docker databases: `P/databases`, `/docker/databases/engines`, `D/databases` | None. | Raw API for engine catalogue, scoped/server-wide lists, create/show/delete, lifecycle, exposure, rebuild, advanced settings, environment variables, logical databases, backup configuration/runs/run-now/restore. `lctl databases` does not cover these resources. |
| Host Docker/Traefik: `D/containers`, `D/containers/:containerId/inspect`, `D/traefik`, `D/traefik/files/:filename`, `D/purge-compose-resources` | None. | Raw API for inspection, host Traefik configuration, and orphaned Compose resource cleanup. No dedicated host maintenance command group. |
| Registry credentials: `/registry-credentials` | Application creation can reference a saved credential ID. | Credential list/create/update/delete and Compose credential attachment use raw API or the web application. |
| Container/Compose/database live logs | No dedicated container log command. Deployment task output is a different resource. | Specialized `/docker/applications/logs` WebSocket supports workload selectors. The generic API command cannot consume this stream. |

Creating a Docker application or Compose record does not deploy it. Deletion preserves named volumes unless explicitly requested otherwise. Deploy success means the backend recorded success; it does not prove the public domain, application routes, database migrations, or health checks are correct.

## DNS, Git integrations, and specialized transports

| Backend module / flow | Dedicated CLI coverage | Remaining access |
| --- | --- | --- |
| DNS providers: `/dns-providers` | None. | Raw API for provider list/connect/delete/check/sync. |
| DNS zones and records: `/dns/domains`, `/dns/record-types` | None. | Raw API for zone CRUD/sync and nested record CRUD. Record update currently uses **POST** `/dns/domains/:domainId/records/:recordId`. |
| Git connections: `/source-controls`, `/settings/git-providers`, `/integrations/git-apps` | Site/application creation can reference an existing connection. | Raw API for connection/repository discovery, token-based connections, disconnect, cached repositories, refresh, and connection testing. Provider installation/OAuth completion needs the provider/browser flow. The `/git/*` aliases declared in `RegisterAPIRoutes` are not mounted by the audited application bootstrap. |
| Team/resource events: `/ws` | `events`, `servers watch`, `tasks watch`, and deployment/dashboard TUIs use the event connection. `--json` produces NDJSON for the explicit event/watch commands. | Specialized WebSocket; raw API cannot subscribe. These are streams, not generic completion guarantees. |
| Remote terminal: `/terminal/ws` | `servers ssh` uses the authenticated terminal WebSocket. | Interactive terminal required; this is not a JSON/raw API operation. |
| Task log/metric streams: `/terminal/logs`, `/metrics/stream` | Deployment TUI/task log viewers and the interactive navigator use these streams. | Specialized clients; not generic raw API coverage. The standalone `logs` command polls stored files instead. |
| Other streams: `/services/status`, `/scripts/execute` | No dedicated stream commands. | Web application or a dedicated WebSocket client. |
| Integration callbacks | No operator command group. | Signed `/provision/:id` and `/webhooks/servers/:id/pulse`; site token `/deploy/:siteId/:token`; backup job callback `/backup/:backup/:token`; Git `/webhooks/git/:provider`; billing `/webhooks/polar`; Docker `/api/webhooks/docker/{applications,composes}/...`. These use integration credentials/signatures and are not ordinary user-authenticated CRUD routes. |

## Automation gaps in existing commands

Global flags are accepted by Cobra, but not every older command implements them. The command index describes syntax; this table describes behavior that matters for scripts.

| Commands | Current limitation |
| --- | --- |
| `databases create`, `firewall add`, `cron add`, `daemons add` | Interactive forms collect required values. `--ci` does not replace those forms, and `--json` does not produce structured creation output. Use the matching raw JSON endpoint for explicit requests. |
| `databases delete`, `firewall delete`, `cron delete`, `daemons delete`, `ssh-keys delete` | Interactive confirmation remains; there is no uniform noninteractive `--yes` path. Cancellation can exit successfully. |
| `services start/stop/restart`, `daemons restart`, the legacy delete commands above, `ssh-keys attach/detach`, `teams switch` | Their API wrappers currently discard the response without validating HTTP status. A command can report success after the server rejects the request. For reliable automation, use the raw endpoint and verify resulting state; these wrappers need further fixes. |
| `status`, `servers metrics --watch`, `servers ssh` | Interactive screens/terminal handling remain active; `--json`/`--ci` do not turn these modes into structured noninteractive commands. |
| `events`, `servers watch`, `tasks watch` | Use `--json` for an event stream. `--ci` alone does not disable their TUI. Server/task watch can miss an already-terminal state, wait for an event indefinitely, or return success on a failure event; do not use them as CI completion checks. |
| `run` | Execution prints raw command output, ignores `--json`, and polls without a bounded wait timeout. `--json` applies to `run --history` only. |
| `logs --type ...` | Prints text even with `--json`. Follow mode polls every two seconds, ignores polling failures, and has no timeout or log-rotation recovery. `logs --json` without a type serializes the source list. This differs from the newer `deploy logs` behavior. |
| `env pull`, `env push` | Output is file content/text, not JSON. Push displays environment values in its diff; `--ci` skips that diff and confirmation and performs the write. Pull writes the selected local file with mode `0644`; handle secret files deliberately. |
| `auth status`, `whoami` | Status is human-oriented and can exit successfully for invalid credentials; `whoami` can fall back to cached identity if its live lookup fails. For an explicit authenticated check, use `lctl api GET /api/auth/user`. |
| `config show --json` | Serializes configuration including stored credentials/profiles. Do not publish its output or treat it as a redacted diagnostic. |
| `teams switch`, configuration/profile/favorite selection commands | Some modes remain interactive or emit human text regardless of global flags. Use explicit profile/team configuration for automation and check each command's help. |

New server/site lifecycle commands, Compose commands, and native deploy trigger/rollback/cancel/log flows have explicit JSON and noninteractive behavior. Their confirmations do not imply a uniform confirmation policy across older commands or the raw API. Raw mutations have **no built-in confirmation**.

Local-only helpers (`config`, `init`, `switch`, `version`, `update`, shell completion, and `ai`) are not backend feature parity. In particular, AI skill management and CLI self-update do not configure application infrastructure.

## Evidence and validation limits

The audit used these baseline revisions plus the additions described above:

| Source | Baseline revision | Reviewed surfaces |
| --- | --- | --- |
| [launchctl-cli](https://github.com/kkz6/launchctl-cli/tree/2fd1ee5c21a46d38bb7739f9ef261e0e176e09a6) | `2fd1ee5c21a46d38bb7739f9ef261e0e176e09a6` | Registered `cmd` tree, `internal/api`, terminal and TUI call sites; added server/site/Compose/deployment/browser-login files. |
| [launch-go](https://github.com/kkz6/launch-go/tree/29cb6ca32a0f5dd8794044e84cabc4a93cc7a2fe) | `29cb6ca32a0f5dd8794044e84cabc4a93cc7a2fe` | All module route registrars, DTOs and relevant services; bootstrap, WebSocket and webhook registrars; shared table routes. Browser device authorization requires its additional routes. |
| [launchctl-docs](https://github.com/kkz6/launchctl-docs/tree/83f72760741b88d5eecc0c5cdf6a43bd430c4c0c) | `83f72760741b88d5eecc0c5cdf6a43bd430c4c0c` | Documentation baseline before this coverage page. |

Route registration is established by [the API bootstrap](https://github.com/kkz6/launch-go/blob/29cb6ca32a0f5dd8794044e84cabc4a93cc7a2fe/cmd/api/module_routes.go), [the module kernel](https://github.com/kkz6/launch-go/blob/29cb6ca32a0f5dd8794044e84cabc4a93cc7a2fe/internal/pkg/app/kernel.go), and the `routes.go` files under each [backend module](https://github.com/kkz6/launch-go/tree/29cb6ca32a0f5dd8794044e84cabc4a93cc7a2fe/internal/modules). Staff routes live in `staff/module.go`; WebSocket routes in `websocket/module.go`; Docker callbacks in `docker/module.go`; table subroutes in `internal/pkg/table/handler.go`.

Validation is local and does not create production resources. Compose HTTP-mock tests cover exact scoped routes and request bodies, empty response handling, preserved volumes, explicit configuration disclosure, terminal failure/cancellation, missing-deployment timeout, and scope mismatch; `go test -race ./cmd/docker ./internal/api` passed. The focused browser-login tests also passed, using mock approval responses and temporary credential files; they do not exercise an actual browser approval against the deployed web application. These tests validate the exercised contracts, not every raw endpoint, cloud account, subscription, provider installation, remote deployment, or browser identity flow. No percentage of full product parity or production end-to-end certification is claimed.
