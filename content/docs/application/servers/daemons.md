---
title: Daemons
description: Manage background processes and workers
---

Daemons are background processes that run continuously on your server. launchctl uses Supervisor to manage daemons, ensuring they stay running and restart automatically if they crash.

## Creating a Daemon
1. Navigate to **Server** → **Daemons**
2. Click **Add Daemon**
3. Configure the daemon:
   - **Name**: Identifier for the daemon
   - **Command**: The command to run
   - **User**: User to run as (usually `launch`)
   - **Directory**: Working directory
   - **Processes**: Number of instances to run
   - **Start Seconds**: Time before marking as started
4. Click **Save**

## Common Daemon Examples
### Laravel Queue Worker

```
Name: laravel-worker
Command: php artisan queue:work --sleep=3 --tries=3 --max-time=3600
Directory: /home/launch/your-site/current
User: launch
Processes: 2
```

### Node.js Application

```
Name: node-app
Command: node server.js
Directory: /home/launch/your-app
User: launch
Processes: 1
```

### WebSocket Server

```
Name: websocket
Command: php artisan websockets:serve
Directory: /home/launch/your-site/current
User: launch
Processes: 1
```

### Horizon (Laravel)

```
Name: horizon
Command: php artisan horizon
Directory: /home/launch/your-site/current
User: launch
Processes: 1
```

## Daemon Configuration Options
| Option | Description | Default |
|--------|-------------|---------|
| Processes | Number of process instances | 1 |
| Start Seconds | Seconds before process is considered started | 1 |
| Stop Wait Seconds | Seconds to wait before force kill | 10 |
| Auto Start | Start when Supervisor starts | Yes |
| Auto Restart | Restart if process exits | Yes |

## Managing Daemons
### Viewing Status

The daemon list shows:
- Daemon name
- Running status
- Number of processes
- Uptime

### Restarting a Daemon

1. Click on the daemon
2. Click **Restart**

All processes for that daemon will be restarted gracefully.

### Stopping a Daemon

1. Click on the daemon
2. Click **Stop**

### Starting a Stopped Daemon

1. Click on the daemon
2. Click **Start**

### Viewing Logs

Daemon output is logged to:
```
/var/log/supervisor/daemon-name-*.log
```

### Deleting a Daemon

1. Click the delete icon
2. Confirm deletion

The daemon will be stopped and removed from Supervisor.

## Supervisor Commands
launchctl manages daemons through Supervisor. Common commands (for reference):

```bash
# Check status of all daemons
sudo supervisorctl status

# Restart a specific daemon
sudo supervisorctl restart daemon-name:*

# View real-time logs
sudo supervisorctl tail -f daemon-name:daemon-name_00
```

## Best Practices
1. **Resource Limits**: Don't run too many processes on small servers
2. **Graceful Shutdown**: Ensure your app handles SIGTERM signals
3. **Logging**: Log output for debugging
4. **Monitoring**: Set up alerts for daemon failures
5. **Memory Management**: Restart workers periodically to prevent memory leaks

### Laravel Queue Example

For Laravel queue workers, include these flags:

```bash
php artisan queue:work --sleep=3 --tries=3 --max-time=3600 --memory=128
```

- `--sleep=3`: Sleep 3 seconds when no jobs
- `--tries=3`: Retry failed jobs 3 times
- `--max-time=3600`: Restart after 1 hour
- `--memory=128`: Restart if memory exceeds 128MB
