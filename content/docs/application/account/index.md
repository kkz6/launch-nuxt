---
title: Account Settings
description: Manage your profile, security, and API tokens
---

Manage your launchctl account, security settings, and personal access tokens.

## Profile
### Updating Profile

1. Go to **Settings** → **Profile**
2. Update your information:
   - Name
   - Email address
   - Profile photo
3. Click **Save**

### Profile Photo

1. Click on your current photo
2. Upload a new image
3. Crop if needed
4. Click **Save**

## Security
### Changing Password

1. Go to **Settings** → **Security**
2. Click **Change Password**
3. Enter current password
4. Enter new password (twice)
5. Click **Update Password**

### Two-Factor Authentication (2FA)

Enable 2FA for enhanced security:

1. Go to **Settings** → **Security**
2. Click **Enable Two-Factor Authentication**
3. Scan QR code with authenticator app:
   - Google Authenticator
   - Authy
   - 1Password
4. Enter verification code
5. Save recovery codes securely
6. Click **Enable**

#### Recovery Codes

Recovery codes let you access your account if you lose your 2FA device:

- Store them securely
- Each code can only be used once
- Generate new codes if needed

#### Disabling 2FA

1. Go to **Settings** → **Security**
2. Click **Disable Two-Factor Authentication**
3. Enter your password
4. Confirm

### Passkeys (WebAuthn)

Use passwordless authentication with passkeys:

1. Go to **Settings** → **Security**
2. Click **Add Passkey**
3. Follow browser prompts
4. Name your passkey
5. Click **Save**

Supported passkeys:
- Touch ID / Face ID
- Windows Hello
- Hardware security keys (YubiKey)

### Active Sessions

View and manage active sessions:

1. Go to **Settings** → **Security** → **Sessions**
2. See all active sessions
3. Click **Revoke** to end a session

## API Tokens
### Creating Tokens

1. Go to **Settings** → **API Tokens**
2. Click **Create Token**
3. Enter token name
4. Select permissions:
   - Read servers
   - Write servers
   - Read sites
   - Write sites
   - Read databases
   - Write databases
   - etc.
5. Click **Create**

::callout{type="warning"}
Copy the token immediately. It won't be shown again.
::

### Token Permissions

| Permission | Description |
|------------|-------------|
| servers:read | View servers |
| servers:write | Create/update servers |
| servers:delete | Delete servers |
| sites:read | View sites |
| sites:write | Create/update sites |
| sites:delete | Delete sites |
| databases:read | View databases |
| databases:write | Create/update databases |
| databases:delete | Delete databases |
| ssh-keys:read | View SSH keys |
| ssh-keys:write | Create/update SSH keys |
| ssh-keys:delete | Delete SSH keys |

### Managing Tokens

#### Viewing Tokens

See all your tokens:
- Token name
- Created date
- Last used date
- Permissions

#### Revoking Tokens

1. Go to **Settings** → **API Tokens**
2. Click **Revoke** on the token
3. Confirm

Revoked tokens immediately stop working.

## Connected Accounts
### Git Providers

Connect your Git accounts:

1. Go to **Settings** → **Source Control**
2. Click **Connect** for your provider:
   - GitHub
   - GitLab
   - Bitbucket
3. Authorize launchctl
4. Select repositories (if applicable)

### Disconnecting Accounts

1. Go to **Settings** → **Source Control**
2. Click **Disconnect**
3. Confirm

::callout{type="info"}
Disconnecting removes launchctl's access but doesn't affect existing deployments.
::

## Danger Zone
### Deleting Account

1. Go to **Settings** → **Account**
2. Scroll to **Danger Zone**
3. Click **Delete Account**
4. Enter your password
5. Type confirmation text
6. Click **Delete**

::callout{type="error"}
Account deletion is permanent. All data, teams, servers, and sites will be deleted.
::

## Best Practices
1. **Enable 2FA**: Protect your account with two-factor auth
2. **Use Passkeys**: Modern, phishing-resistant authentication
3. **Minimal Token Permissions**: Only grant needed permissions
4. **Regular Audits**: Review sessions and tokens periodically
5. **Strong Passwords**: Use unique, complex passwords
