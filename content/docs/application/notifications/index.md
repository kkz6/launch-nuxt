---
title: Notifications
description: Configure alerts via Slack, Discord, Telegram, and Email
---

Stay informed about your infrastructure with launchctl notifications. Receive alerts for server issues, deployments, and more.

## Notification Channels
| Channel | Description |
|---------|-------------|
| Email | Email notifications |
| Slack | Slack workspace messages |
| Discord | Discord channel webhooks |
| Telegram | Telegram bot messages |

## Setting Up Channels
### Email

Email notifications are sent to your account email by default.

1. Go to **Settings** → **Notifications**
2. Email is enabled by default
3. Configure email preferences

### Slack

1. Go to **Settings** → **Notifications**
2. Click **Add Channel** → **Slack**
3. Create a Slack Incoming Webhook:
   - Go to api.slack.com/apps
   - Create new app or select existing
   - Enable Incoming Webhooks
   - Add to workspace
   - Copy webhook URL
4. Paste webhook URL in launchctl
5. Click **Save**

### Discord

1. Go to **Settings** → **Notifications**
2. Click **Add Channel** → **Discord**
3. Create a Discord webhook:
   - Go to Server Settings → Integrations
   - Create Webhook
   - Copy webhook URL
4. Paste webhook URL in launchctl
5. Click **Save**

### Telegram

1. Go to **Settings** → **Notifications**
2. Click **Add Channel** → **Telegram**
3. Configure Telegram bot:
   - Create bot with @BotFather
   - Get bot token
   - Get chat ID
4. Enter bot token and chat ID
5. Click **Save**

## Notification Events
### Server Events

| Event | Description |
|-------|-------------|
| Server Provisioned | New server ready |
| Server Failed | Provisioning failed |
| Connection Lost | Server unreachable |
| Connection Restored | Server back online |
| Threshold Exceeded | Resource limit reached |

### Deployment Events

| Event | Description |
|-------|-------------|
| Deployment Started | Deployment in progress |
| Deployment Succeeded | Deployment completed |
| Deployment Failed | Deployment error |

### Security Events

| Event | Description |
|-------|-------------|
| Vulnerability Audit Complete | Security scan finished |
| Security Updates Available | Updates pending |

### Backup Events

| Event | Description |
|-------|-------------|
| Backup Completed | Backup successful |
| Backup Failed | Backup error |

## Configuring Alerts
### Per-Channel Settings

Configure which events each channel receives:

1. Go to **Settings** → **Notifications**
2. Click on a channel
3. Enable/disable event types
4. Click **Save**

### Server-Specific Alerts

Configure alerts per server:

1. Go to **Server** → **Settings** → **Notifications**
2. Select notification channels
3. Configure threshold alerts

### Threshold Alerts

Set resource thresholds:

1. Go to **Server** → **Monitoring**
2. Configure thresholds:
   - CPU warning/critical
   - Memory warning/critical
   - Disk warning/critical
3. Select notification channels

## Testing Notifications
Send a test notification:

1. Go to **Settings** → **Notifications**
2. Click on a channel
3. Click **Send Test**
4. Verify you received the message

## Managing Channels
### Editing Channels

1. Click on the channel
2. Update configuration
3. Click **Save**

### Removing Channels

1. Click delete icon
2. Confirm deletion

## Best Practices
1. **Don't Over-Notify**: Only enable important events
2. **Use Separate Channels**: Different channels for different severity
3. **Test Regularly**: Verify notifications work
4. **Monitor Delivery**: Check messages are received
5. **Set Up Escalation**: Critical alerts to multiple channels
