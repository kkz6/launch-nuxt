---
title: DNS Management
description: Manage domain DNS records with integrated providers
---

launchctl integrates with DNS providers to manage your domain records directly from the dashboard.

## Supported Providers
| Provider | Features |
|----------|----------|
| Cloudflare | Full DNS management, proxy support |
| DigitalOcean DNS | DNS zone management |

## Connecting DNS Provider
### Cloudflare

1. Go to **Settings** → **DNS Providers**
2. Click **Add Provider** → **Cloudflare**
3. Enter your API credentials:
   - **API Token** (recommended) or
   - **Email + Global API Key**
4. Click **Save**

#### Creating Cloudflare API Token

1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Click **Create Token**
3. Use the **Edit zone DNS** template
4. Select zones to allow
5. Copy the token

### DigitalOcean DNS

1. Go to **Settings** → **DNS Providers**
2. Click **Add Provider** → **DigitalOcean**
3. Enter your API token
4. Click **Save**

## Managing Domains
### Adding a Domain

1. Go to **DNS** → **Domains**
2. Click **Add Domain**
3. Select the DNS provider
4. Enter domain name
5. Click **Add**

launchctl syncs existing records from your provider.

### Syncing Records

To refresh records from provider:

1. Go to domain page
2. Click **Sync Records**

## DNS Records
### Record Types

| Type | Use Case |
|------|----------|
| A | IPv4 address |
| AAAA | IPv6 address |
| CNAME | Alias to another domain |
| MX | Mail server |
| TXT | Text records (SPF, DKIM, etc.) |
| NS | Nameserver |
| SRV | Service location |
| CAA | Certificate authority authorization |

### Creating Records

1. Go to **DNS** → **Domain**
2. Click **Add Record**
3. Configure:
   - **Type**: Record type
   - **Name**: Subdomain or @ for root
   - **Value**: Target/content
   - **TTL**: Time to live
   - **Proxy**: Enable Cloudflare proxy (Cloudflare only)
4. Click **Save**

### Common Records

#### Point Domain to Server

```
Type: A
Name: @
Value: YOUR_SERVER_IP
TTL: Auto
```

#### Point Subdomain to Server

```
Type: A
Name: app
Value: YOUR_SERVER_IP
TTL: Auto
```

#### WWW Redirect

```
Type: CNAME
Name: www
Value: example.com
TTL: Auto
```

#### Email (Google Workspace)

```
Type: MX
Name: @
Value: aspmx.l.google.com
Priority: 1
```

#### SPF Record

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.google.com ~all
```

### Editing Records

1. Click on the record
2. Modify values
3. Click **Save**

### Deleting Records

1. Click delete icon
2. Confirm deletion

## Cloudflare Proxy
When using Cloudflare, enable proxy for:

- DDoS protection
- SSL termination
- Caching
- Performance optimization

::callout{type="info"}
Proxy hides your server IP. Disable for SSH or other non-HTTP services.
::

## Best Practices
1. **Use Low TTL During Migration**: 300 seconds
2. **Increase TTL After Stable**: 3600+ seconds
3. **Document Changes**: Note why records exist
4. **Use Cloudflare Proxy**: When possible for security
5. **Set Up SPF/DKIM/DMARC**: For email deliverability
