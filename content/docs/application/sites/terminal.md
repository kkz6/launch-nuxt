---
title: Terminal
description: Access your site via web-based terminal
---

launchctl provides a web-based terminal that gives you direct SSH access to your site's directory. Run commands, manage files, and debug issues without leaving your browser.

## Accessing the Terminal
1. Navigate to your **Site**
2. Click on the **Terminal** tab
3. The terminal connects automatically via WebSocket

## Terminal Features
### Direct SSH Access

The terminal provides a full SSH session to your server:

- Runs in the site's directory (`/home/launch/your-site`)
- Uses the `launch` user account
- Full shell access with common utilities

### Real-time Connection

The terminal uses WebSocket for real-time communication:

- Low latency input/output
- Connection status indicator
- Automatic reconnection on disconnect

### Terminal Controls

| Control | Description |
|---------|-------------|
| Clear | Clear terminal screen |
| Maximize | Expand terminal to full screen |
| Minimize | Return to normal size |
| Reconnect | Re-establish connection if disconnected |

## Common Commands
### Laravel Artisan

```bash
# Run migrations
php artisan migrate

# Clear caches
php artisan optimize:clear

# View routes
php artisan route:list

# Tinker (REPL)
php artisan tinker

# Queue work (for testing)
php artisan queue:work --once
```

### Composer

```bash
# Install dependencies
composer install

# Update dependencies
composer update

# Dump autoload
composer dump-autoload

# Check for security vulnerabilities
composer audit
```

### NPM / Node

```bash
# Install packages
npm install

# Build assets
npm run build

# Development build
npm run dev
```

### File Operations

```bash
# List files
ls -la

# View file contents
cat .env

# Edit with nano
nano .env

# Check disk usage
du -sh storage/

# Find large files
find . -type f -size +10M
```

### Logs

```bash
# View Laravel logs
tail -f storage/logs/laravel.log

# View last 100 lines
tail -100 storage/logs/laravel.log

# Search logs for errors
grep -i error storage/logs/laravel.log
```

### Git

```bash
# Check status
git status

# View recent commits
git log --oneline -10

# Check current branch
git branch

# Pull latest changes
git pull origin main
```

## Working Directory
The terminal opens in your site's current release directory:

```
/home/launch/your-site/current
```

This is a symlink to the latest deployment release.

### Directory Structure

```
/home/launch/your-site/
├── current -> releases/20241215120000  # Symlink to current release
├── releases/                            # All deployment releases
│   ├── 20241215120000/
│   └── 20241214100000/
├── shared/                              # Shared files/folders
│   ├── storage/
│   └── .env
└── repo/                                # Git repository cache
```

## Security
### User Permissions

The terminal runs as the `launch` user with:

- Read/write access to site files
- Sudo access for specific commands
- No access to other sites on the server

### Session Security

- Sessions are authenticated via your launchctl login
- WebSocket connections are encrypted (WSS)
- Sessions timeout after inactivity

## Best Practices
1. **Don't Edit Live Files**: Make changes through deployments when possible
2. **Be Careful with Destructive Commands**: `rm -rf` is permanent
3. **Use Screen/Tmux for Long Tasks**: Prevents losing work on disconnect
4. **Log Important Commands**: Keep track of manual changes
5. **Test Locally First**: Verify commands before running in production

## Troubleshooting
### Connection Failed

1. Check your internet connection
2. Verify the server is running
3. Try refreshing the page
4. Check if WebSocket is blocked by firewall

### Terminal Not Responding

1. The command may be waiting for input
2. Try pressing `Ctrl+C` to cancel
3. Click reconnect if connection was lost

### Permission Denied

1. Check file/directory permissions
2. Some operations require sudo
3. Ensure you're in the correct directory

### Command Not Found

1. Use full path to binary
2. Check if package is installed
3. Verify PHP/Node version
