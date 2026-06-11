---
title: Firewall Rules
description: Configure network security with firewall rules
---

launchctl provides a simple interface to manage firewall rules on your servers. Control which ports are open and who can access them.

## Default Rules
When a server is provisioned, launchctl configures these default rules:

| Port | Protocol | Action | Description |
|------|----------|--------|-------------|
| 22 | TCP | Allow | SSH access |
| 80 | TCP | Allow | HTTP traffic |
| 443 | TCP | Allow | HTTPS traffic |

## Adding a Firewall Rule
1. Navigate to **Server** → **Firewall**
2. Click **Add Rule**
3. Configure the rule:
   - **Name**: Descriptive name for the rule
   - **Port**: Port number or range (e.g., `3306` or `8000-8100`)
   - **Protocol**: TCP or UDP
   - **Action**: Allow or Block
   - **Source** (optional): IP address or CIDR range
4. Click **Save**

## Common Firewall Configurations
### Allow MySQL Remote Access

```
Port: 3306
Protocol: TCP
Action: Allow
Source: Your IP address
```

::callout{type="warning"}
Only allow MySQL access from specific IP addresses. Never open MySQL to the public internet.
::

### Allow Redis Access

```
Port: 6379
Protocol: TCP
Action: Allow
Source: Your application server IP
```

### Allow Custom Application Port

```
Port: 8080
Protocol: TCP
Action: Allow
Source: 0.0.0.0/0 (any)
```

## Managing Rules
### Editing Rules

1. Go to **Server** → **Firewall**
2. Click on the rule to edit
3. Modify settings
4. Click **Save**

### Deleting Rules

1. Go to **Server** → **Firewall**
2. Click the delete icon
3. Confirm deletion

::callout{type="error"}
Be careful when deleting SSH rules. You may lock yourself out of the server.
::

## IP Whitelisting
For sensitive services, whitelist specific IPs:

1. Create a rule with action "Allow"
2. Specify the source IP or CIDR range
3. Create a default "Block" rule for all other IPs

Example for database access:

```
Rule 1: Allow 192.168.1.100 on port 3306
Rule 2: Block 0.0.0.0/0 on port 3306
```

## Security Best Practices
1. **Principle of Least Privilege**: Only open necessary ports
2. **Use IP Whitelisting**: Restrict access to known IPs when possible
3. **Avoid Default Ports**: Consider changing default ports for sensitive services
4. **Regular Audits**: Review firewall rules periodically
5. **Document Rules**: Use clear names for all rules
