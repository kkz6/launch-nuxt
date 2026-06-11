---
title: Sites
description: Deploy and manage web applications with zero-downtime deployments
---

Sites are web applications deployed on your servers. launchctl supports multiple site types with zero-downtime deployments, Git integration, and SSL certificates.

## Supported Site Types
| Type | Description | Use Case |
|------|-------------|----------|
| Laravel | Full Laravel application support | PHP web applications |
| PHP | Generic PHP applications | WordPress, custom PHP |
| Static | Static HTML/CSS/JS files | Landing pages, SPAs |
| WordPress | Optimized WordPress setup | Blogs, CMS sites |

## Creating a Site
1. Navigate to **Server** → **Sites**
2. Click **Create Site**
3. Configure the site:
   - **Domain**: Your domain name (e.g., `example.com`)
   - **Site Type**: Laravel, PHP, Static, or WordPress
   - **PHP Version**: Select PHP version (for PHP sites)
   - **Web Directory**: Public folder (usually `public` or `public_html`)
4. Click **Create**

## Domain Configuration
### Primary Domain

The main domain for your site. Configure DNS to point to your server IP.

### Domain Aliases

Add additional domains that redirect to your primary domain:

1. Go to **Site** → **Domains**
2. Click **Add Alias**
3. Enter the alias domain
4. Configure DNS for the alias

## Deployment
### Connecting Git Repository

1. Go to **Site** → **Deployment**
2. Click **Connect Repository**
3. Select your provider (GitHub, GitLab, Bitbucket)
4. Authorize access
5. Select the repository and branch

### Deployment Settings

Configure how deployments work:

- **Branch**: Which branch to deploy from
- **Auto Deploy**: Automatically deploy on push
- **Deploy Script**: Custom commands to run
- **Retention**: Number of releases to keep

### Manual Deployment

Trigger a deployment manually:

1. Go to **Site** → **Deployment**
2. Click **Deploy Now**

### Zero-Downtime Deployments

launchctl uses atomic deployments:

1. New release is prepared in a separate directory
2. Dependencies are installed
3. Build commands run
4. Symlink switches to new release instantly
5. Old releases are kept for rollback

## SSL Certificates
### Let's Encrypt (Automatic)

Free SSL certificates with automatic renewal:

1. Go to **Site** → **SSL**
2. Click **Enable SSL**
3. Select **Let's Encrypt**
4. Certificate is issued automatically

### Custom Certificate

Use your own SSL certificate:

1. Go to **Site** → **SSL**
2. Click **Add Certificate**
3. Paste your certificate and private key
4. Click **Install**

## Environment Variables
Manage environment variables:

1. Go to **Site** → **Environment**
2. Edit the `.env` file
3. Click **Save**

Changes take effect on next deployment.

## Queue Workers
For Laravel sites with queues:

1. Go to **Site** → **Queue**
2. Configure queue settings:
   - Connection type
   - Number of workers
   - Max job timeout
3. Enable the queue worker

## Site Actions
- **Deploy**: Trigger a new deployment
- **Rollback**: Revert to a previous release
- **Restart**: Restart PHP-FPM for the site
- **Delete**: Remove the site from the server
