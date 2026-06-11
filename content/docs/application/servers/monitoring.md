---
title: Server Monitoring
description: Monitor server health and receive alerts
---

launchctl provides real-time monitoring of your server's health metrics. Track CPU, memory, disk usage, and receive alerts when thresholds are exceeded.

## Enabling Monitoring
Monitoring is available on Compact and Turbo plans.

1. Navigate to **Server** → **Monitoring**
2. Toggle **Enable Monitoring**
3. Configure your preferences

## Metrics Tracked
### CPU Usage

- Current CPU utilization percentage
- Historical CPU trends
- Per-core breakdown (when available)

### Memory Usage

- Total memory
- Used memory
- Available memory
- Swap usage

### Disk Usage

- Total disk space
- Used space
- Available space
- Usage by mount point

### Network (Coming Soon)

- Incoming bandwidth
- Outgoing bandwidth
- Connection counts

## Viewing Metrics
### Dashboard Overview

The server dashboard shows current metrics at a glance:

- CPU gauge with percentage
- Memory bar with used/total
- Disk usage indicator

### Detailed View

Click **View Details** for:

- Historical graphs
- Metric breakdowns
- Trend analysis

## Threshold Alerts
Configure alerts when metrics exceed thresholds:

1. Go to **Server** → **Monitoring** → **Alerts**
2. Set thresholds:
   - CPU warning: 70%
   - CPU critical: 90%
   - Memory warning: 80%
   - Memory critical: 95%
   - Disk warning: 80%
   - Disk critical: 95%
3. Select notification channels
4. Click **Save**

### Alert Notifications

Receive alerts via:
- Email
- Slack
- Discord
- Telegram

See [Notifications](/docs/application/notifications) for setup.

## Connectivity Monitoring
launchctl periodically checks if your server is reachable:

- **Last Check**: When connectivity was last verified
- **Status**: Connected or Disconnected
- **Alerts**: Notified when server becomes unreachable

## Security Updates
Monitor available security updates:

1. Go to **Server** → **Security**
2. View pending updates
3. See when updates were last checked

### Auto Updates

Enable automatic security updates:

1. Go to **Server** → **Settings**
2. Toggle **Auto Security Updates**

::callout{type="info"}
Auto updates only apply to security patches, not major version upgrades.
::

## Health Checks
### Server Health Score

launchctl calculates an overall health score based on:

- Resource utilization
- Uptime
- Security status
- Configuration best practices

### Health Recommendations

Receive recommendations to improve server health:

- Optimize high CPU processes
- Clear disk space
- Apply security patches
- Review firewall rules

## Troubleshooting
### Metrics Not Updating

1. Verify the server is connected
2. Check the monitoring agent is running
3. Restart the monitoring service

### Missing Historical Data

Historical data is retained for:
- 24 hours at 1-minute resolution
- 7 days at 5-minute resolution
- 30 days at 1-hour resolution

### High Resource Usage

If you see consistently high usage:

1. Identify resource-heavy processes
2. Consider upgrading server size
3. Optimize application code
4. Add caching or load balancing
