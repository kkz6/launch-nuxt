---
title: Deployments
description: Configure and manage application deployments
---

launchctl provides powerful deployment features including Git integration, zero-downtime deployments, and automatic deployments on push.

## Git Integration
### Connecting a Repository

1. Go to **Site** → **Deployment**
2. Click **Connect Repository**
3. Choose your Git provider:
   - **GitHub**: OAuth or GitHub App
   - **GitLab**: OAuth authentication
   - **Bitbucket**: OAuth authentication
4. Select the repository
5. Choose the branch to deploy

### Deploy Keys

launchctl automatically generates deploy keys for private repositories. These are read-only SSH keys that allow pulling code.

## Deployment Process
### How Zero-Downtime Works

```
releases/
├── 20241201120000/  ← Previous release
├── 20241202120000/  ← Current release (linked)
└── 20241203120000/  ← New release being deployed

current → releases/20241202120000/  ← Symlink to current
```

1. New release directory created
2. Code pulled from Git
3. Shared files/folders linked
4. Dependencies installed
5. Build commands executed
6. Symlink updated atomically
7. Old releases pruned

### Deployment Script

Default deployment script for Laravel:

```bash
cd $RELEASE_PATH

composer install --no-interaction --prefer-dist --optimize-autoloader

php artisan migrate --force

php artisan config:cache
php artisan route:cache
php artisan view:cache

php artisan queue:restart
```

Customize the script in **Site** → **Deployment** → **Deploy Script**.

## Deployment Options
### Auto Deploy

Enable automatic deployments when code is pushed:

1. Go to **Site** → **Deployment**
2. Enable **Auto Deploy**
3. Deployments trigger on push to configured branch

### Deployment Webhooks

launchctl creates webhooks on your Git provider to trigger deployments. You can also trigger manually via webhook URL.

### Deployment Retention

Configure how many releases to keep:

1. Go to **Site** → **Deployment** → **Settings**
2. Set **Keep Releases** count
3. Older releases are automatically removed

## Shared Files and Folders
Persist data across deployments:

### Shared Folders

Folders that persist between releases:
- `storage` (Laravel)
- `uploads`

### Shared Files

Files that persist:
- `.env`
- Configuration files

Configure in **Site** → **Deployment** → **Shared**.

## Deployment Hooks
Run custom commands at specific points:

### Before Hooks

Run before the deployment process:
- Database backups
- Maintenance mode

### After Hooks

Run after successful deployment:
- Clear caches
- Restart services
- Send notifications

## Rollback
Revert to a previous release:

1. Go to **Site** → **Deployment** → **History**
2. Find the release to restore
3. Click **Rollback**

The symlink instantly switches to the selected release.

## Deployment History
View all deployments:

- Deployment time
- Git commit
- Status (success/failed)
- Deploy duration
- Deploy log

## Troubleshooting
### Deployment Failed

1. Check the deployment log
2. Verify Git credentials
3. Check server disk space
4. Review build commands

### Webhook Not Triggering

1. Verify webhook is configured
2. Check webhook delivery logs
3. Ensure branch matches

### Missing Files After Deploy

1. Add to shared folders
2. Check symlinks
3. Verify deployment script
