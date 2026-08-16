---
title: Getting Started
description: Welcome to launchctl - Modern server management and deployment platform
---

launchctl is a comprehensive server management and deployment platform that helps you provision servers, deploy traditional sites and containerized applications, and manage your infrastructure with ease.

## Key Features
- **Server Management** - Provision and manage servers across multiple cloud providers (AWS, DigitalOcean, Linode, Vultr, Hetzner)
- **Site Deployments** - Zero-downtime deployments with Git integration (GitHub, GitLab, Bitbucket)
- **Docker Workloads** - Deploy images, Git repositories, Dockerfiles, Compose stacks, and managed databases behind Traefik
- **AI Operations** - Install the `operate-launchctl` Codex skill and safely operate infrastructure through `lctl`
- **Database Management** - MySQL database and user management
- **SSL Certificates** - Automatic Let's Encrypt SSL certificates
- **Backups** - Automated backups to S3 or Dropbox
- **DNS Management** - Manage DNS records with Cloudflare and other providers
- **Team Collaboration** - Invite team members and manage permissions
- **API Access** - Full REST API for automation and integrations
- **Notifications** - Get alerts via Slack, Discord, Telegram, or Email

## Dashboard workflows

:::card-group
::doc-card{title="Application Guide" to="/docs/application"}
Learn how to use the launchctl dashboard to manage your infrastructure
::
::doc-card{title="Docker Applications" to="/docs/application/docker/applications"}
Build, deploy, expose, and monitor containerized applications
::
:::

## Automation and AI

:::card-group
::doc-card{title="CLI Documentation" to="/docs/cli"}
Use the launchctl CLI for command-line server management
::
::doc-card{title="API Reference" to="/docs/api"}
Integrate launchctl with your tools using our REST API
::
::doc-card{title="AI Skill" to="/docs/cli/ai-skill"}
Install the Codex skill and ask AI to operate launchctl safely
::
:::

## Supported Providers
### Cloud Providers
- Amazon Web Services (AWS EC2)
- DigitalOcean
- Linode
- Vultr
- Hetzner

### Git Providers
- GitHub
- GitLab
- Bitbucket

### DNS Providers
- Cloudflare
- DigitalOcean DNS

### Notification Channels
- Slack
- Discord
- Telegram
- Email

## Pricing Plans
| Feature | Hobby ($1.99/mo) | Compact ($6.99/mo) | Turbo ($20/mo) |
|---------|------------------|--------------------| ---------------|
| Servers | 1 | 3 | 10 |
| Sites per Server | 1 | 10 | 20 |
| Backups | - | Yes | Yes |
| Monitoring | - | Yes | Yes |
| Team Members | - | Limited | Unlimited |
