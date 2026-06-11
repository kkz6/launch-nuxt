---
title: Server Providers
description: Connect and manage cloud provider integrations
---

## Amazon Web Services (AWS)
### Prerequisites

- An AWS account
- IAM user with EC2 permissions

### Required Permissions

Create an IAM policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:TerminateInstances",
        "ec2:DescribeInstances",
        "ec2:DescribeRegions",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeInstanceTypes",
        "ec2:CreateKeyPair",
        "ec2:DeleteKeyPair",
        "ec2:DescribeKeyPairs",
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

### Connecting AWS

1. Go to **Settings** → **Server Providers**
2. Click **Add Provider** → **AWS**
3. Enter your credentials:
   - **Access Key ID**: Your IAM access key
   - **Secret Access Key**: Your IAM secret key
4. Click **Save**

## DigitalOcean
### Creating an API Token

1. Log in to your DigitalOcean account
2. Go to **API** → **Tokens**
3. Click **Generate New Token**
4. Give it a name and select **Read & Write** scope
5. Copy the token

### Connecting DigitalOcean

1. Go to **Settings** → **Server Providers**
2. Click **Add Provider** → **DigitalOcean**
3. Paste your API token
4. Click **Save**

## Linode
### Creating an API Token

1. Log in to your Linode account
2. Go to **My Profile** → **API Tokens**
3. Click **Create a Personal Access Token**
4. Set permissions for Linodes (Read/Write)
5. Copy the token

### Connecting Linode

1. Go to **Settings** → **Server Providers**
2. Click **Add Provider** → **Linode**
3. Paste your API token
4. Click **Save**

## Vultr
### Creating an API Key

1. Log in to your Vultr account
2. Go to **Account** → **API**
3. Enable API access if not already enabled
4. Copy your API key

### Connecting Vultr

1. Go to **Settings** → **Server Providers**
2. Click **Add Provider** → **Vultr**
3. Paste your API key
4. Click **Save**

## Hetzner
### Creating an API Token

1. Log in to your Hetzner Cloud Console
2. Select your project
3. Go to **Security** → **API Tokens**
4. Click **Generate API Token**
5. Select **Read & Write** permissions
6. Copy the token

### Connecting Hetzner

1. Go to **Settings** → **Server Providers**
2. Click **Add Provider** → **Hetzner**
3. Paste your API token
4. Click **Save**

## Managing Providers
### Editing Credentials

1. Go to **Settings** → **Server Providers**
2. Click on the provider you want to edit
3. Update credentials
4. Click **Save**

### Removing a Provider

1. Go to **Settings** → **Server Providers**
2. Click the delete icon next to the provider
3. Confirm deletion

::callout{type="warning"}
Removing a provider does not delete servers created with it. Servers will continue to run but cannot be managed through launchctl.
::

## Provider Comparison
| Feature | AWS | DigitalOcean | Linode | Vultr | Hetzner |
|---------|-----|--------------|--------|-------|---------|
| Starting Price | ~$4/mo | $4/mo | $5/mo | $2.50/mo | €3.29/mo |
| Regions | 20+ | 14 | 11 | 25+ | 5 |
| SSD Storage | Yes | Yes | Yes | Yes | Yes |
| Backups | Extra | Extra | Extra | Extra | Extra |
| Support | 24/7 | 24/7 | 24/7 | 24/7 | Business hours |
