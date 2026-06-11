---
title: Servers
description: Provision and manage servers across multiple cloud providers
---

## Supported Cloud Providers
launchctl supports the following cloud providers:

| Provider | Regions | Instance Types |
|----------|---------|----------------|
| Amazon AWS (EC2) | All AWS regions | Various EC2 instance types |
| DigitalOcean | All DO regions | Droplets |
| Linode | All Linode regions | Linodes |
| Vultr | All Vultr regions | Cloud Compute |
| Hetzner | EU & US | Cloud Servers |

## Creating a Server
### Step 1: Connect Your Provider

Before creating a server, you need to connect your cloud provider account:

1. Navigate to **Settings** → **Server Providers**
2. Click **Add Provider**
3. Select your provider and enter the required credentials:
   - **AWS**: Access Key ID and Secret Access Key
   - **DigitalOcean**: API Token
   - **Linode**: API Token
   - **Vultr**: API Key
   - **Hetzner**: API Token

### Step 2: Create a New Server

1. Navigate to **Servers** → **Create Server**
2. Select your cloud provider
3. Choose a region closest to your users
4. Select a server size based on your needs
5. Choose the operating system (Ubuntu 20.04, 22.04, or 24.04 recommended)
6. Give your server a name
7. Click **Create Server**

### Step 3: Server Provisioning

After creation, launchctl will automatically:

1. Create the server on your cloud provider
2. Generate and store SSH key pairs
3. Install required software (PHP, MySQL, Caddy, Redis, etc.)
4. Configure firewall rules
5. Set up monitoring

The provisioning process typically takes 3-5 minutes.

## Server Features
### SSH Keys

Manage SSH keys for server access:

- **Add SSH Key**: Upload your public key for passwordless access
- **Remove SSH Key**: Revoke access by removing keys
- **Multiple Keys**: Add keys for team members

### Firewall Rules

Configure network security:

```
Rule Type    Port    Protocol    Action
─────────────────────────────────────────
SSH          22      TCP         Allow
HTTP         80      TCP         Allow
HTTPS        443     TCP         Allow
MySQL        3306    TCP         Block (default)
```

### Cron Jobs

Schedule automated tasks:

1. Go to **Server** → **Cron Jobs**
2. Click **Add Cron Job**
3. Enter the command and schedule
4. Save the cron job

Example schedules:
- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday

### Daemons

Run background processes:

1. Go to **Server** → **Daemons**
2. Click **Add Daemon**
3. Enter the command and configuration
4. Start the daemon

### Software Management

#### PHP Versions

launchctl supports multiple PHP versions:

- PHP 7.4
- PHP 8.0
- PHP 8.1
- PHP 8.2
- PHP 8.3
- PHP 8.4

You can switch PHP versions per site or set a default for the server.

### Services

Manage installed services:

- **Caddy** - Web server
- **MySQL** - Database server
- **Redis** - Cache and queue
- **Supervisor** - Process manager

Actions available:
- Restart service
- View service status
- View service logs

## Server Monitoring
When enabled, launchctl monitors:

- **CPU Usage** - Processor utilization
- **Memory Usage** - RAM consumption
- **Disk Usage** - Storage utilization
- **Network Traffic** - Bandwidth usage

### Threshold Alerts

Configure alerts when metrics exceed thresholds:

1. Go to **Server** → **Monitoring**
2. Set threshold percentages
3. Configure notification channels

## Security Features
### Security Updates

launchctl tracks available security updates:

- View pending updates
- Enable automatic security updates
- Manual update installation

### Vulnerability Auditing

Run security audits on your servers:

1. Go to **Server** → **Security**
2. Click **Run Audit**
3. Review findings and recommendations
4. Receive results via email

## Server Actions
### Restart Server

Safely restart your server from the dashboard.

### Archive Server

Archive servers you no longer need but want to keep the configuration.

### Delete Server

Permanently delete a server. This action:
- Removes the server from launchctl
- Optionally deletes from cloud provider
- Cannot be undone
