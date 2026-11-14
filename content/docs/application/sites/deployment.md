---
title: Deployments
description: Configure and manage application deployments
---

Launch provides powerful deployment features including Git integration, zero-downtime deployments, and automatic deployments on push.

## Git Integration
---

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

Launch automatically generates deploy keys for private repositories. These are read-only SSH keys that allow pulling code.

## Deployment Process
---

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
7. The selected PHP-FPM runtime is gracefully reloaded (PHP sites)
8. Old releases pruned after successful activation

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
---

### Auto Deploy

Enable automatic deployments when code is pushed:

1. Go to **Site** → **Deployment**
2. Enable **Auto Deploy**
3. Deployments trigger on push to configured branch

### Deployment Webhooks

Launch creates webhooks on your Git provider to trigger deployments. You can also trigger manually via webhook URL.

### Deployment Retention

Configure how many releases to keep:

1. Go to **Site** → **Deployment** → **Settings**
2. Set **Keep Releases** count
3. Older releases are automatically removed

## Shared Files and Folders
---

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
---

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
---

Rollback switches a zero-downtime site to an existing code release. It requires
Editor, Admin, or Owner access in the selected team, and no deployment or rollback
can already be running.

1. Go to **Site** → **Deployment** → **History**
2. Find the release to restore
3. Click **Rollback**

The request creates a new rollback entry in deployment history. Follow that
entry's status and logs until it finishes; accepting the request does not mean
the rollback has completed. The selected release must still exist on the server.
Cleanup may have removed older releases, even though their history is retained.
An unavailable release is rejected without replacing the current symlink.

The **Live** badge comes from the server's actual `current` link, independently of
deployment status. A failed attempt can still be live if it failed after switching
code. Rollback is offered only for a different, retained release associated with a
finished deployment. Failed releases are not offered as rollback targets. The
server checks the target again under the deployment lock before switching.

Release availability updates automatically after deployment and rollback events
and when the connection returns. If the server cannot be inspected, the live
release is unknown and rollback selection is disabled until verification succeeds.

Rollback atomically switches the code symlink. It does **not** restore the
database, reverse migrations, or replace shared files such as `.env` and uploads.
The selected code must be compatible with the current database and shared data.
Deployment hooks are not rerun by rollback.

### PHP runtime recovery

Deployment and rollback refresh the site's selected PHP-FPM version after switching
code. The task log records the code switch and runtime refresh separately. A failed
refresh fails the operation; it does not switch code back automatically. Consult
the **Live** badge and task log before taking another action.

Use **Refresh PHP runtime** to retry activation of the current release without
another rollback, build, or migration. This requires the same team permission as
rollback. PHP-FPM is shared by sites using that PHP version on the server; reloads
are graceful and serialized. Other PHP versions are not reloaded.

Managed Laravel workers, including configured Horizon, Octane, and Reverb processes,
use the existing **Auto-restart queues** setting. When enabled, their restart runs
as a separate task after successful activation. Check its status if a long-running
process still serves old code. When disabled, those processes are left running.
PHP refresh success is not an HTTP health check or confirmation that the worker
restart has finished.

Select a valid PHP version in the site's settings before using rollback or runtime
recovery. Older sites without a selected PHP version retain their existing forward
deployment behavior, with a log warning that automatic PHP refresh was skipped.

Database recovery is a separate operation: see
[Restoring backups](/docs/application/backups#restoring-backups). Docker database
snapshots also have their own Restore action; they are not PHP/Laravel code
release rollbacks.

## Deployment History
---

View all deployments:

- Deployment time
- Git commit
- Status (success/failed)
- Deploy duration
- Deploy log

## Troubleshooting
---

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
