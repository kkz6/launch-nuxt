---
title: Backups
description: Configure automated backups to cloud storage
---

launchctl provides automated backups of your databases and files to cloud storage providers. Never lose data with scheduled backups.

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

To restore a database backup:

```bash
# Download backup
# Extract if compressed
mysql -u username -p database_name < backup.sql
```

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
