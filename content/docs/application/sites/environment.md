---
title: Environment Variables
description: Manage application environment configuration
---

Environment variables store configuration that varies between environments. launchctl provides a secure way to manage these variables.

## Managing Environment Variables
### Editing the .env File

1. Go to **Site** → **Environment**
2. Edit variables in the editor
3. Click **Save**

Changes are saved to the shared `.env` file and persist across deployments.

### Common Variables

Laravel applications typically need:

```ini
APP_NAME="My Application"
APP_ENV=production
APP_KEY=base64:your-key-here
APP_DEBUG=false
APP_URL=https://example.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=your_username
DB_PASSWORD=your_password

CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=your-username
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
```

## Security
### Sensitive Data

Environment variables often contain sensitive data:

- Database passwords
- API keys
- Encryption keys

launchctl encrypts environment data at rest.

### Best Practices

1. **Never commit .env**: Keep out of Git
2. **Use strong passwords**: Generate random passwords
3. **Rotate credentials**: Change keys periodically
4. **Limit access**: Only team members who need it

## Deployment Integration
### Environment on Deploy

During deployment:

1. `.env` file is symlinked from shared folder
2. Environment is available to build commands
3. Application reads configuration

### Different Environments

For staging vs production:

1. Create separate sites
2. Configure different `.env` for each
3. Use appropriate values per environment

## Troubleshooting
### Changes Not Taking Effect

After updating environment:

1. Clear configuration cache:
   ```bash
   php artisan config:clear
   ```
2. Restart PHP-FPM
3. Restart queue workers

### Missing Variables

If application reports missing variables:

1. Verify variable is in `.env`
2. Check for typos
3. Clear config cache
4. Redeploy if needed

### Permission Issues

If `.env` cannot be read:

1. Check file permissions
2. Verify symlink exists
3. Check shared folder configuration
