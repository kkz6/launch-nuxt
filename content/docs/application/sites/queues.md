---
title: Queue Workers
description: Configure background job processing for your sites
---

Queue workers process background jobs in your Laravel applications. launchctl manages queue workers through Supervisor for reliability.

## Setting Up Queues
### Prerequisites

1. Redis installed on server (included by default)
2. Laravel application configured for queues
3. `QUEUE_CONNECTION=redis` in `.env`

### Enabling Queue Workers

1. Go to **Site** → **Queue**
2. Click **Enable Queue**
3. Configure worker settings
4. Click **Save**

## Configuration Options
### Worker Settings

| Option | Description | Default |
|--------|-------------|---------|
| Processes | Number of worker processes | 1 |
| Connection | Queue connection name | redis |
| Queue | Queue names to process | default |
| Sleep | Seconds to sleep when empty | 3 |
| Timeout | Max seconds per job | 60 |
| Tries | Max attempts per job | 3 |
| Max Jobs | Jobs before restart | 1000 |
| Max Time | Seconds before restart | 3600 |
| Memory | MB before restart | 128 |

### Multiple Queues

Process multiple queues with priority:

```
high,default,low
```

Workers process `high` queue first, then `default`, then `low`.

## Worker Management
### Viewing Status

The queue page shows:

- Worker status (running/stopped)
- Number of processes
- Jobs processed
- Failed jobs count

### Restarting Workers

Restart workers after code changes:

1. Go to **Site** → **Queue**
2. Click **Restart Workers**

Or include in deployment script:
```bash
php artisan queue:restart
```

### Stopping Workers

1. Go to **Site** → **Queue**
2. Click **Stop Workers**

Workers finish current job before stopping.

## Deployment Integration
### Auto-Restart on Deploy

Add to deployment script:

```bash
php artisan queue:restart
```

This signals workers to restart after current job.

### Queue During Maintenance

For zero-downtime:

1. Workers process jobs during deploy
2. Restart command sent after deploy
3. Workers finish current job and restart

## Failed Jobs
### Viewing Failed Jobs

1. Go to **Site** → **Queue** → **Failed Jobs**
2. View failed job details
3. Retry or delete jobs

### Retry Failed Jobs

Retry a single job:
```bash
php artisan queue:retry {job-id}
```

Retry all failed:
```bash
php artisan queue:retry all
```

### Clear Failed Jobs

```bash
php artisan queue:flush
```

## Monitoring
### Queue Health

Monitor queue processing:

- Jobs in queue
- Processing rate
- Failed job rate
- Worker uptime

### Horizon (Laravel)

For advanced queue monitoring, use Laravel Horizon:

1. Install Horizon in your application
2. Configure as daemon instead of queue worker
3. Access Horizon dashboard at `/horizon`

## Troubleshooting
### Jobs Not Processing

1. Verify workers are running
2. Check queue connection settings
3. Verify Redis is running
4. Check worker logs

### Jobs Failing

1. View failed job exception
2. Check job timeout settings
3. Verify job code locally
4. Check memory limits

### Workers Restarting

1. Check memory usage
2. Review max jobs setting
3. Check for memory leaks
4. Monitor server resources
