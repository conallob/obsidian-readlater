# Setting Up 1Password CLI Integration

This guide shows you how to use 1Password CLI to securely store and access your news site credentials.

## Prerequisites

1. **1Password Account**: You need an active 1Password subscription
2. **1Password CLI**: Install the `op` command-line tool

## Installation

### macOS

```bash
brew install 1password-cli
```

### Linux

```bash
# Download from https://app-updates.agilebits.com/product_history/CLI2
# Or use your package manager
```

### Windows

```powershell
# Download from https://app-updates.agilebits.com/product_history/CLI2
```

## Initial Setup

### 1. Sign In to 1Password CLI

```bash
# Sign in to your 1Password account
op account add

# Follow the prompts to authenticate
```

### 2. Verify Setup

```bash
# List your accounts
op account list

# Test access
op vault list
```

## Creating Credentials in 1Password

### Option 1: Using 1Password App (Recommended)

1. Open 1Password desktop app
2. Create a new vault (optional) or use existing vault
3. Create Login items for each news site:
   - **Wired**: Create item named "Wired" with username and password
   - **Guardian**: Create item named "Guardian" with username and password
   - **HBR**: Create item named "HBR" with username and password
   - etc.

### Option 2: Using CLI

```bash
# Create a login item
op item create --category=login \
  --title="Wired" \
  --vault="Private" \
  username="your-email@example.com" \
  password="your-password"
```

## Configuring the Plugin

### 1. Get Item References

To reference a credential in your config file, use this format:

```
op://vault-name/item-name/field-name
```

**Examples:**
- `op://Private/Wired/username`
- `op://Private/Wired/password`
- `op://Work/Guardian/username`

### 2. Find Your References

```bash
# List items in a vault
op item list --vault Private

# Get item details
op item get "Wired" --format json

# Get specific field (test your reference)
op read "op://Private/Wired/username"
```

### 3. Update Configuration

Edit your `config.json`:

```json
{
  "outputFile": "ReadLater/Clippings.md",
  "appendMode": true,
  "vaultPath": "/Users/yourname/Documents/ObsidianVault",
  "providers": {
    "wired": {
      "enabled": true,
      "credentials": {
        "username": "op://Private/Wired/username",
        "password": "op://Private/Wired/password"
      }
    },
    "guardian": {
      "enabled": true,
      "credentials": {
        "username": "op://Private/Guardian/username",
        "password": "op://Private/Guardian/password"
      }
    }
  }
}
```

## Running the CLI

### Basic Usage

```bash
# Sync using config file with 1Password credentials
readlater-sync --config config.json --vault ~/Documents/MyVault
```

### Check Available Providers

```bash
# Verify 1Password CLI is available
readlater-sync --list-credential-providers
```

Expected output:
```
Available credential providers:
  - 1password
  - env
```

### Troubleshooting

If you see authentication errors:

```bash
# Verify you're signed in
op account list

# Test credential access
op read "op://Private/Wired/username"

# Sign in if needed
eval $(op signin)
```

## Security Best Practices

1. **Never commit credentials**: Use 1Password references, not plain text
2. **Use separate vaults**: Keep personal and work credentials separate
3. **Rotate passwords**: Update passwords regularly in 1Password
4. **Enable 2FA**: Use 1Password's TOTP for 2FA when possible
5. **Use session timeout**: Configure `op` CLI to require re-authentication

## Automation with Cron

To run automated syncs, you'll need to handle authentication:

### Option 1: Service Account Token

```bash
# Create a service account (1Password Business/Teams)
# Get a token from 1Password.com

# Export token
export OP_SERVICE_ACCOUNT_TOKEN="your-token-here"

# Add to crontab
crontab -e

# Add line:
0 */6 * * * OP_SERVICE_ACCOUNT_TOKEN="your-token" /usr/local/bin/readlater-sync --config /path/to/config.json --vault /path/to/vault
```

### Option 2: Connect Server (Self-Hosted)

Set up [1Password Connect](https://developer.1password.com/docs/connect/) for automated access without exposing service account tokens.

## Advanced: Multiple Vaults

You can organize credentials across multiple vaults:

```json
{
  "providers": {
    "wired": {
      "enabled": true,
      "credentials": {
        "username": "op://Personal/Wired/username",
        "password": "op://Personal/Wired/password"
      }
    },
    "hbr": {
      "enabled": true,
      "credentials": {
        "username": "op://Work/HBR/username",
        "password": "op://Work/HBR/password"
      }
    }
  }
}
```

## Reference Documentation

- [1Password CLI Documentation](https://developer.1password.com/docs/cli/)
- [Secret References](https://developer.1password.com/docs/cli/secret-references/)
- [Service Accounts](https://developer.1password.com/docs/service-accounts/)
