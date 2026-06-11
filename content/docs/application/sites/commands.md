---
title: Commands
description: Execute commands on your sites
---

Run commands directly on your sites through the launchctl dashboard. Execute artisan commands, run scripts, and manage your application.

## Running Commands
### Quick Commands

1. Go to **Site** → **Commands**
2. Enter your command
3. Click **Run**
4. View output in real-time

### Common Commands

#### Laravel Artisan

```bash
# Clear all caches
php artisan optimize:clear

# Run migrations
php artisan migrate --force

# Seed database
php artisan db:seed

# Create storage link
php artisan storage:link

# View routes
php artisan route:list
```

#### Composer

```bash
# Install dependencies
composer install --no-dev --optimize-autoloader

# Update dependencies
composer update

# Dump autoload
composer dump-autoload
```

#### NPM

```bash
# Install packages
npm install

# Build assets
npm run build

# Production build
npm run production
```

## Command History
View previously run commands:

1. Go to **Site** → **Commands** → **History**
2. See command, time, and output
3. Re-run previous commands

## Scheduled Commands
For recurring commands, use:

- **Cron Jobs**: Server-level scheduling
- **Laravel Scheduler**: Application-level scheduling

### Laravel Scheduler Setup

1. Add cron job on server:
   ```
   * * * * * cd /path/to/site && php artisan schedule:run >> /dev/null 2>&1
   ```
2. Define scheduled tasks in `app/Console/Kernel.php`

## Command Environment
Commands run with:

- Site's PHP version
- Site's environment variables
- Site's working directory
- `launch` user permissions

## Security
### Allowed Commands

Commands run as the `launch` user with limited privileges:

- Cannot modify system files
- Cannot access other sites
- Cannot change server configuration

### Dangerous Commands

Be careful with:

- `rm -rf` commands
- Database drops
- Configuration changes

Always test commands locally first.

## Troubleshooting
### Command Not Found

1. Use full path to binary
2. Check PHP version
3. Verify package is installed

### Permission Denied

1. Check file ownership
2. Verify user permissions
3. Use `sudo` carefully (if available)

### Timeout

Long-running commands may timeout:

1. Increase timeout in settings
2. Run as background job
3. Use queue workers for heavy tasks
