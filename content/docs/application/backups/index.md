---
title: Backups
description: Configure automated backups to cloud storage
---

launchctl provides automated backups of your databases and files to cloud storage. Verify a backup and restore before relying on a new configuration.

## Supported Storage Providers
| Provider | Description |
|----------|-------------|
| Amazon S3 | AWS S3 buckets |
| S3 Compatible | Any S3-compatible storage (Wasabi, MinIO, etc.) |
| Dropbox | Dropbox cloud storage |

## Backup Availability
Backups are available on:
- **Compact Plan**: Yes
- **Turbo Plan**: Yes
- **Hobby Plan**: No

## Connecting Storage
### Amazon S3

1. Go to **Settings** → **Backup Storage**
2. Click **Add Provider** → **Amazon S3**
3. Enter credentials:
   - **Access Key ID**
   - **Secret Access Key**
   - **Region**
   - **Bucket Name**
4. Click **Save**

#### S3 Bucket Policy

Ensure your IAM user has these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket/*",
        "arn:aws:s3:::your-bucket"
      ]
    }
  ]
}
```

### Dropbox

1. Go to **Settings** → **Backup Storage**
2. Click **Add Provider** → **Dropbox**
3. Authorize launchctl to access Dropbox
4. Select backup folder

## Creating Backup Jobs
### Database Backup

1. Go to **Server** → **Backups**
2. Click **Create Backup Job**
3. Configure:
   - **Name**: Descriptive name
   - **Type**: Database
   - **Databases**: Select databases to backup
   - **Storage**: Choose provider
   - **Schedule**: When to run
   - **Retention**: Days to keep backups
4. Click **Create**

### Files Backup

1. Go to **Server** → **Backups**
2. Click **Create Backup Job**
3. Configure:
   - **Name**: Descriptive name
   - **Type**: Files
   - **Paths**: Directories to backup
   - **Storage**: Choose provider
   - **Schedule**: When to run
   - **Retention**: Days to keep backups
4. Click **Create**

## Backup Schedule
### Schedule Options

| Schedule | When |
|----------|------|
| Hourly | Every hour |
| Daily | Once per day |
| Weekly | Once per week |
| Custom | Cron expression |

### Recommended Schedules

- **Databases**: Daily at 2 AM
- **Files**: Weekly on Sunday
- **Critical data**: Hourly

## Backup Retention
Configure how long to keep backups:

- **7 days**: Keep one week of backups
- **30 days**: Keep one month
- **90 days**: Keep three months
- **Custom**: Specify days

Older backups are automatically deleted.

## Manual Backups
Create an immediate backup:

1. Go to **Server** → **Backups**
2. Find the backup job
3. Click **Run Now**

## Viewing Backups
### Backup History

View all backups for a job:

- Backup time
- Size
- Status (success/failed)
- Storage location

### Backup Logs

View detailed logs:

1. Click on a backup
2. See full output
3. Review any errors

## Restoring Backups
### Download Backup

1. Go to **Server** → **Backups** → **History**
2. Find the backup
3. Click **Download**

### Restore Database

Native server backups are downloaded and restored with the database engine's
own tools. The native backup API does not expose a restore action.

For **Docker database snapshots**, open the database's **Backups** tab, select a
successful snapshot, and choose **Restore**. Review the target before confirming.
Restore requires Admin or Owner access in the selected team. The target must be
on the same server and use the same database engine; another project on that
server can be selected when it belongs to the same team.

Restore can overwrite or delete target data. Back up the target first and ensure
the application is ready for the restored schema and data. This operation is
separate from [code rollback](/docs/application/sites/deployment#rollback).

#### Archive checks and failures

The downloaded archive is fully decompressed and checked before database ingest
starts or Redis is stopped. Missing, unreadable, empty, truncated, or corrupt
archives fail before target data is changed. Keep enough free disk space for the
compressed archive and its decompressed contents.

PostgreSQL restore ignores client startup files and stops on SQL errors. A failed
database command or lost execution connection is not reported as a completed
restore. Once ingest starts, failure can leave **partial changes**; restore is not
an atomic transaction and does not automatically undo work already applied.
Inspect the failure and target state before retrying. A disconnected client is
not proof that the remote operation stopped.

Archive validation detects unusable compressed data; it does not prove schema
compatibility, application correctness, or completeness of the original backup.
After a successful restore, verify the expected data and application behavior.

#### MongoDB source and target

New snapshots retain the database name actually dumped, even if the backup
configuration later changes. Restore selects that recorded source namespace and
maps its collections into the chosen target database. For example, a snapshot of
`production.orders` restored into `staging` writes `staging.orders`.

Existing collections with matching mapped names are dropped and recreated from
the archive. Other target collections and unrelated databases are left intact;
this is not a full replacement of every collection in the target database.

MongoDB snapshots without recorded source identity, full-instance snapshots, or
archives missing the recorded source namespace are refused before writes. Take
a new snapshot configured for the specific database instead of guessing the
source from current settings. The source and target names must be safe, ordinary
database names; system databases and namespace patterns are not restore targets.

## Troubleshooting
### Backup Failed

1. Check storage credentials
2. Verify bucket/folder permissions
3. Check server disk space
4. Review backup logs

### Backup Too Large

1. Exclude unnecessary files
2. Enable compression
3. Use incremental backups
4. Increase storage quota

### Missing Backups

1. Verify backup job is enabled
2. Check schedule settings
3. Review retention policy
4. Check storage provider
