---
title: SSL Certificates
description: Secure your sites with SSL/TLS certificates
---

Secure your sites with HTTPS using free Let's Encrypt certificates or your own custom certificates.

## Let's Encrypt
### Automatic SSL

launchctl integrates with Let's Encrypt for free, automatic SSL:

1. Go to **Site** → **SSL**
2. Click **Request Certificate**
3. Select **Let's Encrypt**
4. Certificate is issued within minutes

### Requirements

For Let's Encrypt to work:

- Domain DNS must point to your server
- Port 80 must be accessible
- Domain must be publicly reachable

### Automatic Renewal

Certificates are automatically renewed:

- Checked daily
- Renewed 30 days before expiry
- No action required

### Wildcard Certificates

For wildcard certificates (`*.example.com`):

1. Configure DNS provider integration
2. Request wildcard certificate
3. DNS challenge is used for verification

## Custom Certificates
### Installing a Custom Certificate

1. Go to **Site** → **SSL**
2. Click **Add Certificate**
3. Enter certificate details:
   - **Certificate**: Your SSL certificate (PEM format)
   - **Private Key**: Your private key
   - **Certificate Chain**: Intermediate certificates (optional)
4. Click **Install**

### Certificate Format

Certificates should be in PEM format:

```
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiUMA...
-----END CERTIFICATE-----
```

### Purchasing Certificates

Recommended certificate authorities:
- DigiCert
- Comodo
- GlobalSign
- Sectigo

## TLS Configuration
### TLS Versions

launchctl enforces modern TLS:

- TLS 1.2 ✓
- TLS 1.3 ✓
- TLS 1.0/1.1 ✗ (disabled)

### Cipher Suites

Secure cipher suites are configured automatically for:
- Strong encryption
- Forward secrecy
- Compatibility with modern browsers

## HTTPS Redirect
Force all traffic to HTTPS:

1. Go to **Site** → **SSL**
2. Enable **Force HTTPS**

All HTTP requests redirect to HTTPS.

## Certificate Status
The SSL settings page checks the public HTTPS endpoint, so the status reflects
the certificate a browser actually receives rather than only the saved Caddy
configuration. It shows:

- Issued to (domain)
- Issued by (authority)
- Valid from/to dates
- Days until expiry

If the status is **Not issued**, **Invalid**, **Expired**, or **Unreachable**,
fix DNS or firewall access first and select **Retry certificate**. launchctl
reapplies the site's Caddy configuration and verifies the public endpoint again.

## Troubleshooting
### Certificate Not Issued

1. Verify DNS points to server
2. Check port 80 is open
3. Ensure domain is accessible
4. Review Let's Encrypt logs

### Certificate Expired

If automatic renewal failed:

1. Go to **Site** → **SSL**
2. Click **Retry certificate**
3. Check for errors

### Mixed Content Warnings

After enabling SSL:

1. Update hardcoded HTTP URLs
2. Use relative URLs or `//`
3. Update asset URLs in database

### Browser Shows Not Secure

1. Verify certificate is installed
2. Check certificate chain is complete
3. Clear browser cache
4. Test with SSL checker tools
