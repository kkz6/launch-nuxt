---
title: Site Commands
description: CLI commands for site management
---

Manage your sites from the command line.

::callout{type="info"}
CLI commands are currently in development. Syntax may change.
::

## List Sites
```bash
lctl sites
```

### Options

| Option | Description |
|--------|-------------|
| `--server <server>` | Filter by server |
| `--json` | Output as JSON |

### Example Output

```
ID    DOMAIN           SERVER        PHP    STATUS
1     example.com      production    8.3    active
2     staging.app      staging       8.3    active
3     dev.local        development   8.2    active
```

## Get Site Details
```bash
lctl sites:show <site>
```

### Example

```bash
lctl sites:show example.com
```

### Output

```
Site: example.com
ID: 1
Server: production
Type: laravel
PHP Version: 8.3
Repository: github.com/user/repo
Branch: main
SSL: enabled
Status: active
```

## Create Site
```bash
lctl sites:create <server>
```

Interactive prompts guide you through site creation.

### Options

| Option | Description |
|--------|-------------|
| `--domain <domain>` | Domain name |
| `--type <type>` | Site type (laravel, php, static) |
| `--php <version>` | PHP version |
| `--directory <path>` | Web directory |

### Example

```bash
lctl sites:create production \
  --domain example.com \
  --type laravel \
  --php 8.3 \
  --directory public
```

## Delete Site
```bash
lctl sites:delete <site>
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |

## Environment Variables
### View Environment

```bash
lctl env <site>
```

### Edit Environment

```bash
lctl env:edit <site>
```

Opens your default editor to modify the `.env` file.

### Set Variable

```bash
lctl env:set <site> KEY=value
```

### Example

```bash
lctl env:set example.com APP_DEBUG=false
```

## SSL Certificates
### Enable SSL

```bash
lctl ssl:enable <site>
```

### Disable SSL

```bash
lctl ssl:disable <site>
```

### Renew Certificate

```bash
lctl ssl:renew <site>
```
