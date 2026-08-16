---
title: Docker Workloads
description: Run applications, Compose stacks, and managed databases on Docker servers
---

A Docker server is provisioned with Docker CE and Traefik. Workloads are organized into projects, which keep related applications, Compose stacks, databases, and shared project environment values together.

## Workload model

| Resource      | Purpose                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| Project       | Groups workloads and project-level environment values on one Docker server   |
| Application   | Runs one container built from an image, Git repository, or inline Dockerfile |
| Compose stack | Deploys multiple services from Git-hosted or inline Compose YAML             |
| Database      | Runs a managed PostgreSQL, MySQL, MariaDB, Redis, or MongoDB container       |

## Dashboard guides

:::card-group
::doc-card{title="Docker Applications" to="/docs/application/docker/applications"}
Create, build, deploy, expose, and operate single-container applications
::
:::

## Automation and AI

:::card-group
::doc-card{title="Docker Applications API" to="/docs/api/docker-applications"}
Automate projects and applications with authenticated API requests
::
::doc-card{title="AI Skill" to="/docs/cli/ai-skill"}
Ask Codex to operate Docker workloads through lctl
::
:::

## Create a Docker project

1. Create or open a provisioned server whose type is **Docker**.
2. Open the server's **Projects** tab.
3. Select **New Project**.
4. Enter a name unique to that server and an optional description.
5. Open the project to create applications, Compose stacks, or databases.

Project environment values can be referenced by workloads as `${{project.KEY}}` and are resolved when a workload deploys or runs.

## Host-level tools

Docker server pages also provide:

- **Containers** for runtime status and `docker inspect` details.
- **Terminal** for host access and container-scoped shells.
- **Traefik configuration** for host and workload routing.
- **Networks**, metrics, daemons, schedules, and maintenance actions.

Use the workload detail page for normal configuration. Directly editing generated Traefik files or changing containers on the host can drift from launchctl's stored configuration.
