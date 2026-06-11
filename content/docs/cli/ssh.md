---
title: SSH Commands
description: CLI commands for SSH access
---

Connect to your servers directly from the command line.

::callout{type="info"}
CLI commands are currently in development. Syntax may change.
::

## SSH into Server
```bash
lctl ssh <server>
```

Opens an interactive SSH session to the server.

### Options

| Option | Description |
|--------|-------------|
| `--user <user>` | SSH user (default: launch) |

### Example

```bash
# Connect as launch user
lctl ssh production

# Connect as root
lctl ssh production --user root
```

## Run Command
Execute a command on the server without interactive session:

```bash
lctl ssh <server> -- <command>
```

### Examples

```bash
# Check disk space
lctl ssh production -- df -h

# Run artisan command
lctl ssh production -- "cd /home/launch/example.com && php artisan migrate"

# View logs
lctl ssh production -- tail -f /var/log/syslog
```

## Site Commands
Run commands in a site's directory:

```bash
lctl run <site> <command>
```

### Examples

```bash
# Run artisan command
lctl run example.com "php artisan cache:clear"

# Run composer
lctl run example.com "composer install"

# Run npm
lctl run example.com "npm run build"
```

## Copy Files
### Upload

```bash
lctl scp:up <server> <local-path> <remote-path>
```

### Download

```bash
lctl scp:down <server> <remote-path> <local-path>
```

### Examples

```bash
# Upload file
lctl scp:up production ./config.json /home/launch/config.json

# Download logs
lctl scp:down production /var/log/app.log ./app.log
```

## SSH Config
Generate SSH config for direct access:

```bash
lctl ssh:config
```

### Output

```
# launchctl Servers
Host launch-production
    HostName 192.168.1.100
    User launch
    IdentityFile ~/.ssh/launch_key

Host launch-staging
    HostName 192.168.1.101
    User launch
    IdentityFile ~/.ssh/launch_key
```

Add to `~/.ssh/config` for direct access:

```bash
ssh launch-production
```

## Troubleshooting
### Connection Refused

1. Verify server is running: `lctl servers:show <server>`
2. Check firewall rules allow SSH
3. Verify your SSH key is added

### Permission Denied

1. Check you're using the correct user
2. Verify SSH key is on the server
3. Re-add your SSH key if needed

### Timeout

1. Check server connectivity
2. Verify server IP address
3. Check network/firewall settings
