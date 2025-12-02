# Obsidian Read Later Sync

An Obsidian plugin that syncs read-later articles from multiple news sites into your Obsidian vault. Works both as an Obsidian plugin and as a standalone headless CLI tool.

## Features

- **Multi-Provider Support**: Sync from Wired, The Guardian, Harvard Business Review, Medium, Irish Times, and more
- **Dual Mode**: Use as an Obsidian plugin with UI or as a headless CLI tool
- **Secure Credentials**: Integration with 1Password CLI, Bitwarden CLI, or environment variables
- **Obsidian Sync Compatible**: Direct vault integration with automatic sync triggering
- **Git Sync Support**: Auto-commit and push changes to Git repositories
- **Automated Syncing**: Optional automatic sync at configured intervals
- **Customizable Templates**: Format articles to match your note-taking style
- **Append or Replace**: Choose to append new articles or replace existing content
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Supported News Sites

- Wired.com
- The Guardian
- Harvard Business Review (HBR)
- Medium
- Irish Times

## Installation

### As Obsidian Plugin

1. Download the latest release
2. Extract files to `<vault>/.obsidian/plugins/obsidian-readlater/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### As Headless CLI

```bash
npm install -g obsidian-readlater
```

Or use directly:

```bash
npx obsidian-readlater --help
```

## Usage

### Obsidian Plugin

1. Open Settings → Read Later Sync
2. Configure your output file path
3. Enable desired providers and add credentials
4. Click the cloud icon in the ribbon or use Command Palette: "Sync all read-later lists"

### Headless CLI

#### Basic Usage

Using a config file:

```bash
readlater-sync --config config.json
```

Using command-line arguments:

```bash
readlater-sync --provider wired \
  --username user@example.com \
  --password yourpassword \
  --output articles.md \
  --append
```

#### With Obsidian Vault Integration

```bash
# Sync directly to your Obsidian vault
readlater-sync --config config.json --vault ~/Documents/MyVault

# With Git auto-commit and push
readlater-sync --config config.json --vault ~/Documents/MyVault --git-sync
```

#### Secure Credentials

Use 1Password CLI references instead of plain text:

```bash
# With 1Password CLI
readlater-sync --provider wired \
  --username "op://Private/Wired/username" \
  --password "op://Private/Wired/password" \
  --vault ~/Documents/MyVault
```

See [docs/SETUP-1PASSWORD.md](docs/SETUP-1PASSWORD.md) for detailed setup.

### Configuration File Format

#### Basic Configuration

```json
{
  "outputFile": "ReadLater/Clippings.md",
  "appendMode": true,
  "template": "## {{title}}\n- **URL:** {{url}}\n\n---\n",
  "providers": {
    "wired": {
      "enabled": true,
      "credentials": {
        "username": "user@example.com",
        "password": "password123"
      }
    }
  }
}
```

#### With Vault and Secure Credentials

```json
{
  "outputFile": "ReadLater/Clippings.md",
  "appendMode": true,
  "vaultPath": "/Users/yourname/Documents/ObsidianVault",
  "gitSync": true,
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
        "username": "env://GUARDIAN_USERNAME",
        "password": "env://GUARDIAN_PASSWORD"
      }
    }
  }
}
```

See example configs: `config.example.json`, `config-1password.example.json`, `config-env.example.json`

## Template Variables

Customize article formatting with these variables:

- `{{title}}` - Article title
- `{{url}}` - Article URL
- `{{source}}` - Provider name
- `{{author}}` - Article author
- `{{date}}` - Publication date
- `{{excerpt}}` - Article excerpt
- `{{tags}}` - Article tags (comma-separated)

Conditional blocks:

```
{{#if excerpt}}
- **Excerpt:** {{excerpt}}
{{/if}}
```

## Development

### Build Plugin

```bash
npm install
npm run dev      # Development with watch mode
npm run build    # Production build
```

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
npm run lint:fix
```

## Adding New Providers

To add support for a new news site:

1. Create a new provider class in `src/providers/`
2. Extend either `BrowserProvider` or `APIProvider`
3. Implement required methods: `authenticate()`, `fetchArticles()`, `extractArticles()`
4. Register the provider in `src/providers/registry.ts`
5. Add settings UI in `src/settings.ts`

Example:

```typescript
import { BrowserProvider } from './base';
import { ReadLaterArticle } from '../types';

export class MyNewsProvider extends BrowserProvider {
  name = 'mynews';
  displayName = 'My News Site';
  loginUrl = 'https://mynews.com/login';
  readLaterUrl = 'https://mynews.com/saved';

  async performLogin(): Promise<void> {
    // Login implementation
  }

  async isAuthenticated(): Promise<boolean> {
    // Check authentication
  }

  async extractArticles(): Promise<ReadLaterArticle[]> {
    // Extract articles from page
  }
}
```

## Security & Credential Management

### Recommended: Use Secret Managers

Instead of storing credentials in plain text, use external secret managers:

**1Password CLI:**
```json
"credentials": {
  "username": "op://Private/Wired/username",
  "password": "op://Private/Wired/password"
}
```

**Environment Variables:**
```json
"credentials": {
  "username": "env://WIRED_USERNAME",
  "password": "env://WIRED_PASSWORD"
}
```

**Bitwarden CLI:**
```json
"credentials": {
  "username": "bw://wired-login/username",
  "password": "bw://wired-login/password"
}
```

See detailed setup guides:
- [1Password CLI Setup](docs/SETUP-1PASSWORD.md)
- [Obsidian Sync Integration](docs/OBSIDIAN-SYNC.md)

### Security Best Practices

- **Plugin Mode**: Credentials are stored in Obsidian's data.json (encrypted by Obsidian)
- **CLI Mode**: Use 1Password CLI, Bitwarden CLI, or environment variables
- **Never commit** credentials to version control
- The `.gitignore` file excludes sensitive files
- Use separate credentials for automation vs. personal use

## Troubleshooting

### Authentication Failures

- Verify credentials are correct
- Some sites may require 2FA - check provider documentation
- Try manual login in a browser first to ensure account is working

### No Articles Found

- Ensure you have articles saved in your read-later list on the provider's website
- Check provider's website structure hasn't changed
- Enable verbose mode in CLI: `--verbose`

### Playwright Issues

The plugin uses Playwright for browser automation. If you encounter issues:

```bash
npx playwright install chromium
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.
