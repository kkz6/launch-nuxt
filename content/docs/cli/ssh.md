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
launch ssh <server>
```

Opens an interactive SSH session to the server.

### Options

| Option | Description |
|--------|-------------|
| `--user <user>` | SSH user (default: launch) |

### Example

```bash
# Connect as launch user
launch ssh production

# Connect as root
launch ssh production --user root
```

## Run Command
Execute a command on the server without interactive session:

```bash
launch ssh <server> -- <command>
```

### Examples

```bash
# Check disk space
launch ssh production -- df -h

# Run artisan command
launch ssh production -- "cd /home/launch/example.com && php artisan migrate"

# View logs
launch ssh production -- tail -f /var/log/syslog
```

## Site Commands
Run commands in a site's directory:

```bash
launch run <site> <command>
```

### Examples

```bash
# Run artisan command
launch run example.com "php artisan cache:clear"

# Run composer
launch run example.com "composer install"

# Run npm
launch run example.com "npm run build"
```

## Copy Files
### Upload

```bash
launch scp:up <server> <local-path> <remote-path>
```

### Download

```bash
launch scp:down <server> <remote-path> <local-path>
```

### Examples

```bash
# Upload file
launch scp:up production ./config.json /home/launch/config.json

# Download logs
launch scp:down production /var/log/app.log ./app.log
```

## SSH Config
Generate SSH config for direct access:

```bash
launch ssh:config
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

1. Verify server is running: `launch servers:show <server>`
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
