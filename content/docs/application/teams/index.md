---
title: Teams
description: Collaborate with team members and manage permissions
---

launchctl supports team collaboration, allowing you to invite members and manage access to your servers and sites.

## Understanding Teams
Each launchctl account can have multiple teams:

- **Personal Team**: Your default team, created with your account
- **Additional Teams**: Create teams for different projects or clients

## Creating a Team
1. Go to **Settings** → **Teams**
2. Click **Create Team**
3. Enter team name
4. Click **Create**

## Team Settings
### Team Profile

1. Go to **Team Settings**
2. Update:
   - Team name
   - Team image/avatar
3. Click **Save**

### Switching Teams

1. Click team selector in navigation
2. Select the team to switch to

## Team Members
### Inviting Members

1. Go to **Team Settings** → **Members**
2. Click **Invite Member**
3. Enter email address
4. Select role
5. Click **Send Invitation**

The invitee receives an email to join your team.

### Member Roles

| Role | Permissions |
|------|-------------|
| Owner | Full access, can delete team |
| Admin | Full access, cannot delete team |
| Member | Access to servers and sites |

### Managing Members

#### Changing Roles

1. Go to **Team Settings** → **Members**
2. Click on member
3. Select new role
4. Click **Save**

#### Removing Members

1. Go to **Team Settings** → **Members**
2. Click remove icon
3. Confirm removal

### Pending Invitations

View and manage pending invitations:

1. Go to **Team Settings** → **Invitations**
2. See pending invites
3. Resend or cancel invitations

## Team Resources
Team resources include:

- **Servers**: All servers created by team members
- **Sites**: All sites on team servers
- **Databases**: All databases on team servers
- **Backups**: Team backup configurations
- **API Tokens**: Team API access

### Resource Limits

Resource limits are per-team based on subscription:

| Plan | Servers | Sites/Server | Members |
|------|---------|--------------|---------|
| Hobby | 1 | 1 | 1 |
| Compact | 3 | 10 | 5 |
| Turbo | 10 | 20 | Unlimited |

## Team Billing
### Subscription

Each team has its own subscription:

1. Go to **Team Settings** → **Billing**
2. View current plan
3. Upgrade or manage subscription

### Billing Management

- View invoices
- Update payment method
- Change subscription plan

## Transferring Ownership
Transfer team ownership to another member:

1. Go to **Team Settings**
2. Click **Transfer Ownership**
3. Select new owner
4. Confirm transfer

::callout{type="warning"}
Only team owners can transfer ownership. This action cannot be undone.
::

## Deleting a Team
1. Go to **Team Settings**
2. Click **Delete Team**
3. Confirm by typing team name
4. Click **Delete**

::callout{type="error"}
Deleting a team removes all servers, sites, and data. This cannot be undone.
::

## Best Practices
1. **Use Descriptive Names**: Name teams by project or client
2. **Limit Admin Access**: Only give admin to trusted members
3. **Regular Audits**: Review member access periodically
4. **Separate Environments**: Use different teams for prod/staging
5. **Document Access**: Keep track of who has access to what
