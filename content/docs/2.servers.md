---
title: Servers
description: Learn how to provision, connect, and manage servers with launchctl.
---

# Server Management

launchctl makes it easy to provision and manage servers from multiple cloud providers or connect your existing infrastructure.

## Supported Providers

launchctl supports the following cloud providers for automatic server provisioning:

| Provider | Regions | Features |
|----------|---------|----------|
| DigitalOcean | 14 regions | Droplets, managed databases |
| Hetzner | 5 regions | Cloud servers, dedicated |
| Vultr | 25 regions | Cloud compute, bare metal |
| AWS | 20+ regions | EC2 instances |
| Linode | 11 regions | Linodes, managed databases |

You can also connect any server with SSH access, including on-premise servers.

## Provisioning a New Server

### Step 1: Connect Your Provider

1. Go to **Settings** > **Integrations**
2. Select your cloud provider
3. Enter your API credentials
4. Click **Connect**

### Step 2: Create a Server

1. Click **Add Server** from the dashboard
2. Select your connected provider
3. Choose your server configuration:
   - **Region** - Select the closest region to your users
   - **Size** - Choose CPU, RAM, and storage
   - **Name** - Give your server a memorable name

4. Click **Create Server**

launchctl will automatically:
- Provision the server
- Install required software (Nginx, PHP, MySQL, etc.)
- Configure security settings
- Set up monitoring

This process typically takes 5-10 minutes.

## Connecting an Existing Server

If you have an existing server, you can connect it to launchctl:

### Requirements

- Ubuntu 20.04, 22.04, or 24.04
- Root SSH access
- Minimum 1GB RAM
- Clean server (no existing web server software)

### Connection Steps

1. Click **Add Server** > **Connect Existing Server**
2. Enter your server's IP address
3. Provide SSH credentials (password or key)
4. Click **Connect**

launchctl will connect and configure your server automatically.

## Server Dashboard

Once connected, each server has a dedicated dashboard with:

### Overview Tab

- Server status and uptime
- Resource usage (CPU, RAM, Disk)
- Quick actions (restart, refresh)

### Sites Tab

- List of deployed sites
- Deployment status
- Quick access to site settings

### Databases Tab

- Database instances
- Storage usage
- User management

### Network Tab

- Firewall rules
- SSH keys
- Security settings

## Server Configuration

### PHP Versions

launchctl supports multiple PHP versions:

```bash
# Available versions
PHP 7.4
PHP 8.0
PHP 8.1
PHP 8.2
PHP 8.3
```

You can install multiple versions and select the default for each site.

### Nginx Configuration

Custom Nginx configurations can be added per-site:

```nginx
# Example: Add custom headers
location / {
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
}
```

### Firewall Rules

By default, launchctl configures:

- **Port 22** - SSH access
- **Port 80** - HTTP traffic
- **Port 443** - HTTPS traffic

Additional ports can be opened through the Network tab.

## Server Maintenance

### Scheduled Tasks

Create cron jobs directly from the dashboard:

1. Go to **Schedulers** tab
2. Click **Add Scheduler**
3. Enter the command and schedule
4. Save

### Backups

Configure automatic backups:

- **Frequency** - Daily, weekly, or custom
- **Retention** - How long to keep backups
- **Storage** - Local or cloud storage

### Updates

Keep your server secure with:

- Automatic security updates
- One-click package updates
- PHP version upgrades

## Troubleshooting

### Connection Issues

If you can't connect to your server:

1. Verify the IP address is correct
2. Check that SSH port 22 is open
3. Ensure your SSH credentials are valid
4. Check if the server is running

### Performance Issues

For slow server performance:

1. Check resource usage in the dashboard
2. Review recent deployments
3. Check application logs
4. Consider upgrading server size

## Next Steps

- [Site Deployments](/docs/sites) - Deploy your first application
- [Database Setup](/docs/databases) - Configure your databases
- [SSL Certificates](/docs/ssl) - Secure your sites with HTTPS
