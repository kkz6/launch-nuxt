---
title: Docker Applications
description: Deploy single-container applications from images, Git repositories, or Dockerfiles
---

Docker applications are single-container workloads inside a project. A deployment pulls or builds an image, recreates the container with the stored runtime configuration, connects routing and volumes, and records deployment history.

## Before you deploy

You need:

- A provisioned **Docker** server.
- A project on that server.
- The container's internal listening port.
- A source: a tagged image, a Git repository, or Dockerfile content.
- For private sources, a connected source-control installation or registry credential.

Use explicit image tags such as `nginx:1.27` or `ghcr.io/acme/api:v3`. The API does not silently add `latest`.

## Create an application

Open **Server → Projects → your project → Applications**, then select **New Application**. Enter a name, internal port, and one source type.

### Docker image

Use a public or private pre-built image. Public images require only the image reference. Private images support:

- A reusable saved registry credential.
- Inline registry username, password, and optional registry URL stored for this application.

A saved credential and inline credentials are mutually exclusive. Docker Hub is used when no custom registry URL is supplied.

### Git repository

Select a connected repository or enter a public clone URL, then choose the branch and builder:

| Builder    | Behavior                                                                |
| ---------- | ----------------------------------------------------------------------- |
| Auto       | Uses a repository Dockerfile when detected; otherwise uses Nixpacks     |
| Nixpacks   | Detects the application stack and creates an image without a Dockerfile |
| Dockerfile | Builds a selected Dockerfile path, including paths inside a monorepo    |

Choose where the build runs:

- **Server** clones and builds on the Docker host.
- **GitHub Actions** commits `.github/workflows/launch-deploy.yml`, builds with Buildx, pushes the image to GHCR, and calls launchctl to deploy it.

GitHub Actions builds require a connected GitHub source control. The application page shows setup, permission, synchronization, and workflow status.

### Inline Dockerfile

Paste a Dockerfile when the source does not need a repository. The stored Dockerfile is built on the target server when you deploy.

## Configure the application

The application page separates build-time and runtime concerns:

### Environment

- **Runtime variables** are passed to the container with `-e`. Secret values are masked after saving.
- **Build secrets** are available only while building and are never returned by the API.
- **Project references** such as `${{project.DATABASE_URL}}` are resolved during deploy or run.

After changing runtime variables, deploy the application to recreate the container with the new values. **Reload** only restarts the existing container and does not replace its environment. For GitHub Actions applications, build-secret changes mark the workflow out of sync; use **Re-sync workflow** to publish the updated secrets and workflow.

### Domains and HTTPS

Add a hostname after its DNS points to the Docker server. Traefik routes the domain to the application's internal port and can issue a Let's Encrypt certificate. Each domain supports:

- A path and internal path.
- Optional path stripping.
- A container-port override.
- Let's Encrypt or a stored certificate.
- DNS validation against the server's public IP.

### Volumes, redirects, and schedules

- **Volumes** persist data across container replacement. File and directory mounts are supported by the application configuration.
- **Redirects** add HTTP redirects through the application's routing configuration.
- **Schedules** run commands inside the application container on a cron expression.

### Advanced runtime settings

Advanced settings include restart policy, CPU and memory limits or reservations, a health-check command, extra `host:container` port mappings, internal port, optional HTTP basic authentication, builder selection, Dockerfile path, and the generated Traefik configuration.

Changes marked “applies on next deploy” do not mutate the running container immediately.

## Deploy and operate

Select **Deploy** to start a new deployment. The application moves through `idle`, `building`, `running`, `stopped`, or `failed`; an application being removed temporarily uses `deleting`.

Deployment records move through:

| Status      | Meaning                                     |
| ----------- | ------------------------------------------- |
| `pending`   | Work is queued                              |
| `building`  | An image is being built                     |
| `deploying` | The image and container are being activated |
| `success`   | The container started successfully          |
| `failed`    | The build or activation failed              |
| `cancelled` | The deployment was cancelled                |

Available lifecycle actions are:

- **Deploy/Rebuild**: run the complete source-to-container deployment pipeline.
- **Reload**: restart the existing container without rebuilding or replacing its environment.
- **Stop** and **Start**: stop or start the existing container.
- **Terminal**: open a shell inside the application container.
- **Logs**: stream `docker logs` output from the running container.

The **Deployments** tab records build output, errors, trigger source, image reference, commit metadata, and GitHub Actions run information. GitHub Actions deployments can also display their live job and step timeline.

## GitHub Actions maintenance

The **GitHub Actions** tab is available when the build location is GitHub Actions. It can:

- Enable or disable deploys on pushes to the configured branch.
- Re-sync the managed workflow, variables, and build secrets.
- Rotate the deploy token.
- Open the workflow and Actions run in GitHub.
- Disable GitHub Actions builds and return to server-side builds.

Disabling GitHub Actions does not silently delete the workflow file from your repository. Remove it manually if it is no longer needed.

## Delete safely

Deleting an application stops and removes its container asynchronously. Named volumes are preserved by default. Only enable volume removal when the stored data is intentionally disposable.

## Troubleshooting

### Build failed

1. Open **Deployments** and inspect the failing build step and output.
2. Confirm the branch, builder, Dockerfile path, and build secrets.
3. For server builds, confirm disk and memory capacity on the Docker host.
4. For GitHub Actions, open the linked run and verify the GitHub App permissions.

### Container runs but the domain fails

1. Verify the process listens on `0.0.0.0`, not only `127.0.0.1`.
2. Confirm the application's internal port or domain-specific port override.
3. Use **Validate DNS** and confirm the A record reaches the Docker server.
4. Review application logs and the generated Traefik configuration.

### Configuration changes are missing

Runtime environment, build-secret, Dockerfile, and build-setting changes require a new deployment. GitHub Actions workflow changes also require a successful re-sync. Reload is only a restart of the existing container.

For automation and AI-driven operation, continue with the [Docker Applications API](/docs/api/docker-applications) or [AI Skill](/docs/cli/ai-skill).
