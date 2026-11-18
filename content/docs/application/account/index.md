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
### GitHub repositories

1. Select the destination workspace, then open **Settings** > **Connections**.
2. Choose **Connect GitHub** and confirm the named workspace. Authorized team members, including people invited later, can use its selected repositories. Use separate private workspaces for separate account access.
3. Verify your GitHub identity and choose an existing app installation. You can reuse the same installation from another launchctl login without revoking the first connection.
4. Explicitly select the repositories for this workspace and save. A new connection starts with no repositories selected.

**Manage repositories for this account** changes only this workspace's selection. Existing selections are preserved during verification until you save a reviewed change. You must retain the GitHub administration rights used to authorize access; if access expires or is revoked, verify GitHub again.

**Manage GitHub app access** changes which repositories the shared installation can access. A repository added there does not automatically become selected in any launchctl account. Each workspace must select it separately. Removing a repository or uninstalling the app directly on GitHub affects every workspace using that installation. Use the repository selection in launchctl to change access for only the current workspace. GitLab and Bitbucket connections are not currently available.

Sites, applications, and Compose list only selected repositories. When a workload needs private submodules or other private dependencies, select those repositories explicitly as dependencies. Public URL builds require HTTPS without embedded credentials and use no GitHub connection credentials or inherited server credentials.

The same repository can be selected independently in more than one workspace. GitHub Actions setup is limited to one workspace at a time because GitHub secrets are shared within the repository. Selecting it in another workspace does not interrupt existing workflows; enabling Actions there requires the previous workspace's cleanup to finish.

### Disconnecting an account

Choose **Disconnect from this account** on the connection in **Settings** > **Connections**. This disconnects only the current workspace; other workspace selections remain intact. Running applications remain running, but future authenticated deployments and queued GitHub work for the disconnected connection stop. Removing a repository from the selection has the same effect for workloads that depend on it.

GitHub workflows and secrets may remain on GitHub and need separate cleanup. Revoking the app's authorization directly on GitHub can affect the same GitHub identity's connections across multiple launchctl logins. Reconnect locally first when recovering this workspace's access.

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

## Admin user management

The admin panel shares the application’s header, font, and horizontal navigation. Use the tabs for **Overview**, **Users**, **Invitations**, **Servers**, **Failures**, and **Observability**; scroll the tab row on smaller screens. The page frame stays visible while the initial content loads. Use the available search, filters, and pagination to find records.

Overview shows compact subscription and revenue totals, revenue history, and recent payments. In **Failures**, select **View log** to open the log drawer and **Copy log** to copy its output. **Observability** groups runtime and database metrics above the query-analysis tabs.

Site, server, and Docker lifecycle changes, along with staff account and invitation actions, update the affected admin resource lists, user resource tabs, and server details automatically. Statuses, resource counts, and server deletion availability are reconciled with the API, including after a live connection reconnects. Existing content remains visible during background updates. These resource views use live updates without a manual Refresh control. Failed requests offer **Retry** or **Try again**. The billing Overview keeps its **Refresh** control because billing changes do not currently update it automatically.

In **Invitations → Invite user**, choose a plan and use the calendar to select a future trial end date. The trial ends at the start of the selected date (00:00 UTC).

Open **Admin → Users** and select a user. A second navigation row starts with the user’s name, followed by **Teams**, **Servers**, and **Sites**. The name tab contains account details, **Staff access**, and **Subscriptions**; resource tabs open directly to their content. **Spectate** and the account actions appear only on the name tab. There, super administrators can open **More actions** (the ellipsis button) to **Suspend**, **Reactivate**, or **Delete user**. Site deletion is available on the intended site row.

**Spectate** always opens a read-only session: you can inspect the account, but cannot deploy or change its resources. Exit Spectate to make changes using your own account and its permissions in the selected team. See [team roles](/docs/application/teams#member-roles).

Super administrators can change **Staff access** to **Regular user**, **Support**, or **Super admin**, select **Save role**, and confirm the change. Regular user removes access to the admin panel; it does not change team permissions. Role changes are audited and apply to subsequent admin requests.

You cannot change your own staff role or demote the last super administrator. Ask another super administrator to change your role when needed. Support staff can view user details but cannot change roles or delete users or sites.

To delete another staff account, first change its staff access to **Regular user**, then choose **More actions → Delete user**. If the customer has a paid order or a current or past paid subscription, review the warning and check the acknowledgment box to enable **Delete anyway**. Subscription cancellation and payment refunds are handled separately. Self-deletion is blocked.

See the [staff API](/docs/api/staff) for the corresponding administrative endpoints.

## Best Practices
1. **Enable 2FA**: Protect your account with two-factor auth
2. **Use Passkeys**: Modern, phishing-resistant authentication
3. **Minimal Token Permissions**: Only grant needed permissions
4. **Regular Audits**: Review sessions and tokens periodically
5. **Strong Passwords**: Use unique, complex passwords
