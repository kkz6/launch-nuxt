---
title: Server Commands
description: CLI commands for server management
---

Manage your servers from the command line.

::callout{type="info"}
CLI commands are currently in development. Syntax may change.
::

## List Servers
```bash
lctl servers
```

### Options

| Option | Description |
|--------|-------------|
| `--team <name>` | Filter by team |
| `--status <status>` | Filter by status |
| `--json` | Output as JSON |

### Example Output

```
ID    NAME           IP              PROVIDER       STATUS
1     production     192.168.1.100   digitalocean   active
2     staging        192.168.1.101   digitalocean   active
3     development    192.168.1.102   hetzner        active
```

## Get Server Details
```bash
lctl servers:show <server>
```

### Example

```bash
lctl servers:show production
```

### Output

```
Server: production
ID: 1
IP Address: 192.168.1.100
Provider: digitalocean
Region: nyc1
Size: s-2vcpu-4gb
PHP Version: 8.3
Status: active
Created: 2024-01-15
```

## Create Server
```bash
lctl servers:create
```

Interactive prompts guide you through server creation.

### Options

| Option | Description |
|--------|-------------|
| `--name <name>` | Server name |
| `--provider <provider>` | Cloud provider |
| `--region <region>` | Server region |
| `--size <size>` | Server size |
| `--php <version>` | PHP version |

### Example

```bash
lctl servers:create \
  --name my-server \
  --provider digitalocean \
  --region nyc1 \
  --size s-2vcpu-4gb \
  --php 8.3
```

## Delete Server
```bash
lctl servers:delete <server>
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |

## Reboot Server
```bash
lctl servers:reboot <server>
```

## Server Services
### List Services

```bash
lctl services <server>
```

### Restart Service

```bash
lctl services:restart <server> <service>
```

### Example

```bash
lctl services:restart production nginx
```

## SSH Keys
### List Keys

```bash
lctl ssh-keys <server>
```

### Add Key

```bash
lctl ssh-keys:add <server> --name "My Key" --key "ssh-ed25519 AAAA..."
```

### Remove Key

```bash
lctl ssh-keys:remove <server> <key-id>
```
