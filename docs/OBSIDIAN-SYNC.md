# Obsidian Sync Integration

This guide explains how to use the headless CLI to sync directly to your Obsidian vault, enabling seamless integration with Obsidian Sync or Git-based sync solutions.

## Overview

The CLI can write directly to your Obsidian vault, which means:
- Changes are immediately available in Obsidian (if running)
- Obsidian Sync automatically syncs changes to all your devices
- Git-based sync workflows are supported with auto-commit
- Works with any vault, whether using Obsidian Sync, Git, or manual sync

## Basic Setup

### 1. Locate Your Vault

Find the path to your Obsidian vault:

**macOS:**
```bash
# Default location (if using iCloud)
/Users/yourname/Library/Mobile Documents/iCloud~md~obsidian/Documents/YourVault

# Or local vault
/Users/yourname/Documents/ObsidianVault
```

**Linux:**
```bash
/home/yourname/Documents/ObsidianVault
```

**Windows:**
```powershell
C:\Users\yourname\Documents\ObsidianVault
```

### 2. Configure CLI with Vault Path

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
    }
  }
}
```

### 3. Run Sync

```bash
readlater-sync --config config.json
```

The CLI will:
1. Fetch articles from enabled providers
2. Write to the vault at the specified path
3. Trigger Obsidian Sync (if running)

## Using with Obsidian Sync

Obsidian Sync is 1Password's official sync service. The CLI integrates seamlessly:

### Setup

1. Enable Obsidian Sync in your vault (Settings → Sync)
2. Configure the CLI with your vault path
3. Run the CLI - changes will automatically sync

### How It Works

When writing to the vault, the CLI:
1. Writes the file to the vault directory
2. Touches `.obsidian/workspace.json` to trigger sync
3. Obsidian Sync detects the change and syncs to all devices

### Verification

1. Run the CLI sync
2. Open Obsidian on another device
3. Wait a few seconds - changes should appear automatically

### Troubleshooting

If changes don't sync:

1. **Check Obsidian Sync status** (bottom-right of Obsidian)
2. **Verify vault path** is correct
3. **Ensure Obsidian is running** on at least one device
4. **Check sync settings** - make sure the output folder is not excluded

## Using with Git Sync

Many users prefer Git for version control. The CLI supports automatic Git commits and pushes.

### Initial Setup

1. Initialize Git in your vault (if not already done):

```bash
cd /path/to/vault
git init
git remote add origin https://github.com/yourname/vault.git
```

2. Create a `.gitignore` to exclude Obsidian workspace files:

```
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.trash/
```

3. Configure the CLI with Git sync enabled:

```json
{
  "outputFile": "ReadLater/Clippings.md",
  "appendMode": true,
  "vaultPath": "/Users/yourname/Documents/ObsidianVault",
  "gitSync": true,
  "providers": { ... }
}
```

### Running with Git Sync

```bash
readlater-sync --config config.json
```

The CLI will:
1. Pull latest changes from remote
2. Fetch articles and write to vault
3. Commit changes with message: `chore: sync read-later articles (N articles)`
4. Push to remote

### Command-Line Override

```bash
# Enable Git sync for this run only
readlater-sync --config config.json --git-sync

# Specify vault path
readlater-sync --config config.json --vault ~/Documents/Vault --git-sync
```

### Authentication

For Git pushes, you'll need credentials:

**Option 1: SSH Key (Recommended)**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add to GitHub/GitLab
cat ~/.ssh/id_ed25519.pub

# Use SSH remote
git remote set-url origin git@github.com:yourname/vault.git
```

**Option 2: Personal Access Token**
```bash
# Configure Git credential helper
git config --global credential.helper store

# Or use SSH instead (recommended)
```

## Automated Sync with Cron

Set up automatic syncing to keep your vault updated.

### macOS (using cron)

```bash
# Edit crontab
crontab -e

# Add entry (sync every 6 hours)
0 */6 * * * /usr/local/bin/readlater-sync --config /path/to/config.json >> /tmp/readlater-sync.log 2>&1
```

### macOS (using launchd - Recommended)

Create `~/Library/LaunchAgents/com.readlater.sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.readlater.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/readlater-sync</string>
        <string>--config</string>
        <string>/Users/yourname/.config/readlater/config.json</string>
    </array>
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>StandardOutPath</key>
    <string>/tmp/readlater-sync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/readlater-sync.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.readlater.sync.plist
```

### Linux (systemd timer)

Create `/etc/systemd/system/readlater-sync.service`:

```ini
[Unit]
Description=Read Later Sync
After=network.target

[Service]
Type=oneshot
User=yourname
ExecStart=/usr/local/bin/readlater-sync --config /home/yourname/.config/readlater/config.json
```

Create `/etc/systemd/system/readlater-sync.timer`:

```ini
[Unit]
Description=Read Later Sync Timer

[Timer]
OnBootSec=15min
OnUnitActiveSec=6h

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable readlater-sync.timer
sudo systemctl start readlater-sync.timer
```

## Conflict Resolution

### Obsidian Sync Conflicts

Obsidian Sync handles conflicts automatically by creating duplicate files. If you see duplicates:

1. Review both files
2. Merge content manually
3. Delete duplicate
4. The CLI always appends, so conflicts should be rare

### Git Conflicts

If Git sync encounters conflicts:

1. The push will fail (check logs)
2. Manually resolve:
   ```bash
   cd /path/to/vault
   git pull --rebase
   git push
   ```
3. Or disable Git sync temporarily and resolve manually

## Best Practices

1. **Use append mode**: Set `"appendMode": true` to avoid data loss
2. **Regular backups**: Even with sync, maintain backups
3. **Test first**: Try manual sync before enabling automation
4. **Monitor logs**: Check logs for errors
5. **Exclude workspace files**: Don't sync workspace.json if using Git
6. **Use dedicated folder**: Keep read-later articles in a dedicated folder

## Troubleshooting

### "Invalid vault path" Error

```bash
# Verify vault exists
ls -la /path/to/vault/.obsidian

# Check permissions
ls -ld /path/to/vault
```

### Changes Not Appearing in Obsidian

1. Check if file was actually written:
   ```bash
   cat /path/to/vault/ReadLater/Clippings.md
   ```

2. Force Obsidian to refresh:
   - Close and reopen the file
   - Restart Obsidian

### Git Sync Failures

```bash
# Check Git status
cd /path/to/vault
git status

# View recent commits
git log --oneline -5

# Check remote connectivity
git remote -v
git fetch --dry-run
```

## Advanced: Multiple Vaults

Sync to different vaults based on content:

```json
{
  "vaultPath": "/Users/yourname/Documents/WorkVault",
  "providers": {
    "hbr": { "enabled": true, ... }
  }
}
```

Run different configs:
```bash
# Personal vault
readlater-sync --config config-personal.json

# Work vault
readlater-sync --config config-work.json
```
