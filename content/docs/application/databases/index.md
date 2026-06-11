---
title: Databases
description: Create and manage MySQL databases and users
---

launchctl provides MySQL database management directly from the dashboard. Create databases, manage users, and control access permissions.

## Creating a Database
1. Navigate to **Server** → **Databases**
2. Click **Create Database**
3. Enter a database name
4. Click **Create**

Database names follow these rules:
- Alphanumeric characters and underscores
- Cannot start with a number
- Maximum 64 characters

## Database Users
### Creating a User

1. Go to **Server** → **Databases** → **Users**
2. Click **Create User**
3. Configure user:
   - **Username**: User identifier
   - **Password**: Strong password (auto-generated option available)
   - **Databases**: Select databases to grant access
4. Click **Create**

### User Permissions

Users can have access to:
- Specific databases only
- All databases
- Remote connections (optional)

### Updating Password

1. Go to **Server** → **Databases** → **Users**
2. Click on the user
3. Click **Change Password**
4. Enter new password
5. Click **Save**

## Database Access
### Local Access

From your application on the same server:

```php
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=your_user
DB_PASSWORD=your_password
```

### Remote Access

To connect remotely:

1. Create firewall rule for port 3306
2. Grant remote access to user
3. Use server IP as host

::callout{type="warning"}
Only enable remote access when necessary and restrict to specific IPs.
::

## Database Operations
### Viewing Databases

The database list shows:
- Database name
- Size
- Tables count
- Users with access

### Deleting a Database

1. Go to **Server** → **Databases**
2. Click delete icon
3. Confirm deletion

::callout{type="error"}
Deleting a database permanently removes all data. Create a backup first.
::

### Deleting a User

1. Go to **Server** → **Databases** → **Users**
2. Click delete icon
3. Confirm deletion

## Database Connection
### Connection Details

Find your connection details at **Server** → **Databases**:

- Host: `127.0.0.1` (local) or server IP (remote)
- Port: `3306`
- Database: Your database name
- Username: Your database user
- Password: User password

### Testing Connection

Test from command line:

```bash
mysql -h 127.0.0.1 -u username -p database_name
```

## MySQL Configuration
### Default Settings

launchctl configures MySQL with:
- UTF8MB4 character set
- InnoDB storage engine
- Optimized buffer settings

### Custom Configuration

For custom MySQL settings, contact support or modify directly on the server (advanced).

## Best Practices
1. **One User Per Application**: Don't share database users
2. **Strong Passwords**: Use generated passwords
3. **Limit Remote Access**: Only enable when needed
4. **Regular Backups**: Set up automated backups
5. **Monitor Size**: Track database growth
