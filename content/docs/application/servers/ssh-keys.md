---
title: SSH Keys
description: Manage SSH keys for secure server access
---

SSH keys provide secure, passwordless access to your servers. launchctl manages SSH keys for both the platform and your team members.

## How SSH Keys Work
launchctl uses SSH key pairs for server authentication:

1. **Platform Keys**: launchctl generates a unique key pair for each server for management operations
2. **User Keys**: You can add your own SSH keys for manual access

## Adding SSH Keys
### Adding a Personal SSH Key

1. Navigate to **Server** → **SSH Keys**
2. Click **Add SSH Key**
3. Enter a name for the key
4. Paste your public key (starts with `ssh-rsa`, `ssh-ed25519`, etc.)
5. Click **Save**

### Generating a New SSH Key

If you don't have an SSH key, create one:

```bash
# Generate an ED25519 key (recommended)
ssh-ed25519 -t ed25519 -C "your@email.com"

# Or generate an RSA key
ssh-keygen -t rsa -b 4096 -C "your@email.com"
```

Your public key will be in:
- `~/.ssh/id_ed25519.pub` (ED25519)
- `~/.ssh/id_rsa.pub` (RSA)

## Connecting to Your Server
Once your key is added:

```bash
# Connect as the launch user
ssh launch@your-server-ip

# Connect as root (if needed)
ssh root@your-server-ip
```

## Managing SSH Keys
### Viewing Keys

View all SSH keys added to a server:

1. Go to **Server** → **SSH Keys**
2. See all keys with their fingerprints

### Removing Keys

To revoke access:

1. Go to **Server** → **SSH Keys**
2. Click the delete icon next to the key
3. Confirm deletion

::callout{type="warning"}
Removing a key immediately revokes SSH access for that key.
::

## SSH Configuration
### Default SSH User

launchctl creates a `launch` user on each server with sudo privileges. This user is used for:

- Site deployments
- Running commands
- File management

### SSH Port

By default, SSH runs on port 22. You can change this in the firewall settings.

## Security Best Practices
1. **Use Strong Keys**: Use ED25519 or RSA 4096-bit keys
2. **Protect Private Keys**: Never share your private key
3. **Use Passphrases**: Add a passphrase to your private key
4. **Rotate Keys**: Periodically update SSH keys
5. **Remove Unused Keys**: Delete keys for team members who no longer need access

## Troubleshooting
### Permission Denied

If you get "Permission denied":

1. Verify your key is added to the server
2. Check you're using the correct username
3. Ensure your private key permissions are correct:

```bash
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

### Connection Timeout

If the connection times out:

1. Verify the server is running
2. Check firewall allows port 22
3. Verify the server IP address
