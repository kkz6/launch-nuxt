---
title: Cron Jobs
description: Schedule automated tasks on your servers
---

Cron jobs allow you to schedule commands to run automatically at specified intervals. launchctl provides an easy interface to manage cron jobs without editing crontab files directly.

## Creating a Cron Job
1. Navigate to **Server** → **Cron Jobs**
2. Click **Add Cron Job**
3. Configure the job:
   - **Command**: The command to execute
   - **User**: User to run the command as
   - **Schedule**: When to run (cron expression)
4. Click **Save**

## Cron Schedule Syntax
Cron uses a 5-field time specification:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
```

## Common Schedules
| Schedule | Expression | Description |
|----------|------------|-------------|
| Every minute | `* * * * *` | Runs every minute |
| Every 5 minutes | `*/5 * * * *` | Runs every 5 minutes |
| Every hour | `0 * * * *` | Runs at the start of every hour |
| Every day at midnight | `0 0 * * *` | Runs daily at 00:00 |
| Every day at noon | `0 12 * * *` | Runs daily at 12:00 |
| Every Monday | `0 0 * * 1` | Runs every Monday at midnight |
| First of month | `0 0 1 * *` | Runs at midnight on the 1st |
| Every weekday | `0 9 * * 1-5` | Runs at 9 AM, Monday-Friday |

## Example Cron Jobs
### Laravel Scheduler

```bash
cd /home/launch/your-site && php artisan schedule:run >> /dev/null 2>&1
```

Schedule: `* * * * *`

### Database Backup

```bash
mysqldump -u root database_name > /home/launch/backups/db-$(date +\%Y\%m\%d).sql
```

Schedule: `0 2 * * *` (daily at 2 AM)

### Clear Application Cache

```bash
cd /home/launch/your-site && php artisan cache:clear
```

Schedule: `0 */6 * * *` (every 6 hours)

### Log Rotation

```bash
find /home/launch/your-site/storage/logs -name "*.log" -mtime +7 -delete
```

Schedule: `0 0 * * 0` (weekly on Sunday)

## Managing Cron Jobs
### Viewing Jobs

All cron jobs are listed on the **Cron Jobs** page with their:
- Command
- Schedule
- Last run time
- Status

### Editing Jobs

1. Click on the cron job
2. Modify settings
3. Click **Save**

### Deleting Jobs

1. Click the delete icon
2. Confirm deletion

## Output and Logging
By default, cron output is discarded. To log output:

```bash
# Log to a file
your-command >> /home/launch/logs/cron.log 2>&1

# Discard output (default)
your-command >> /dev/null 2>&1
```

## Best Practices
1. **Use Full Paths**: Always use absolute paths in commands
2. **Test Commands**: Run commands manually first
3. **Log Output**: Keep logs for debugging
4. **Avoid Overlap**: Ensure jobs complete before next run
5. **Set Timeouts**: Add timeouts for long-running tasks
