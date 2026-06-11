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
launch servers
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
launch servers:show <server>
```

### Example

```bash
launch servers:show production
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
launch servers:create
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
launch servers:create \
  --name my-server \
  --provider digitalocean \
  --region nyc1 \
  --size s-2vcpu-4gb \
  --php 8.3
```

## Delete Server
```bash
launch servers:delete <server>
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |

## Reboot Server
```bash
launch servers:reboot <server>
```

## Server Services
### List Services

```bash
launch services <server>
```

### Restart Service

```bash
launch services:restart <server> <service>
```

### Example

```bash
launch services:restart production nginx
```

## SSH Keys
### List Keys

```bash
launch ssh-keys <server>
```

### Add Key

```bash
launch ssh-keys:add <server> --name "My Key" --key "ssh-ed25519 AAAA..."
```

### Remove Key

```bash
launch ssh-keys:remove <server> <key-id>
```
