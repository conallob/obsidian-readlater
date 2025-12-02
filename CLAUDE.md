# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that syncs read-later articles from multiple news sites (Wired, Guardian, HBR, Medium, Irish Times) into Obsidian notes. The plugin supports both desktop Obsidian usage and headless/CLI mode for automated syncing without the Obsidian app.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development mode (watch & rebuild on changes)
npm run dev

# Production build
npm run build

# Install Playwright browsers (required for runtime provider automation)
# Note: This is NOT needed for the build process, only for running the plugin/CLI
npx playwright install chromium

# Run tests
npm test

# Lint code
npm run lint
npm run lint:fix

# Version bump (updates manifest.json and versions.json)
npm run version
```

## Testing the Plugin

### In Obsidian Desktop

1. Build the plugin: `npm run build`
2. Create a symlink in your test vault:
   ```bash
   ln -s /path/to/obsidian-readlater /path/to/vault/.obsidian/plugins/obsidian-readlater
   ```
3. Reload Obsidian and enable the plugin in Settings

### Headless/CLI Mode

```bash
# Using config file
node dist/cli.js --config test-config.json

# Direct provider test
node dist/cli.js --provider wired --username user@example.com --password pass123 --output test.md --verbose
```

## Architecture

### Core Components

- **src/main.ts**: Main Obsidian plugin entry point. Handles plugin lifecycle, commands, ribbon icons, and orchestrates syncing.
- **src/settings.ts**: Settings UI and configuration management. Defines `DEFAULT_SETTINGS` and `ReadLaterSettingTab`.
- **src/types.ts**: TypeScript interfaces and abstract base classes for the entire plugin.

### Provider System (Modular Architecture)

The plugin uses a provider pattern to support multiple news sites:

- **src/providers/registry.ts**: Central registry that manages all available providers. Instantiates enabled providers based on settings.
- **src/providers/base.ts**: Abstract base classes (`BrowserProvider` for browser automation, `APIProvider` for API-based providers).
- **src/providers/*.ts**: Individual provider implementations (wired.ts, guardian.ts, hbr.ts, medium.ts, irishtimes.ts).

Each provider must implement:
- `authenticate()`: Log into the news site
- `fetchArticles()`: Retrieve read-later articles
- `extractArticles()`: Parse HTML/API response into `ReadLaterArticle[]`

### Headless Mode

- **src/cli.ts**: Standalone CLI tool that can run without Obsidian installed. Uses the same provider system but outputs to files directly.

### Data Flow

1. User triggers sync (ribbon click, command, or CLI)
2. `main.ts` calls `syncAllProviders()`
3. Registry returns enabled providers
4. Each provider authenticates and fetches articles
5. Articles are formatted using the template
6. Results are appended/written to the output file

## Adding New Providers

To add support for a new news site:

1. **Create provider file**: `src/providers/newsite.ts`
   ```typescript
   import { BrowserProvider } from './base';
   import { ReadLaterArticle } from '../types';

   export class NewSiteProvider extends BrowserProvider {
     name = 'newsite';
     displayName = 'New Site';
     loginUrl = 'https://newsite.com/login';
     readLaterUrl = 'https://newsite.com/saved';

     async performLogin(): Promise<void> {
       await this.page.fill('input[type="email"]', this.config.credentials.username);
       await this.page.fill('input[type="password"]', this.config.credentials.password);
       await this.page.click('button[type="submit"]');
     }

     async isAuthenticated(): Promise<boolean> {
       // Check if logged in successfully
     }

     async extractArticles(): Promise<ReadLaterArticle[]> {
       // Parse page and extract articles
     }
   }
   ```

2. **Register in registry**: Edit `src/providers/registry.ts`:
   ```typescript
   import { NewSiteProvider } from './newsite';

   // In registerProviders():
   this.register('newsite', NewSiteProvider);
   ```

3. **Add to settings UI**: Edit `src/settings.ts`:
   ```typescript
   // In ReadLaterSettingTab.display():
   this.addProviderSettings('newsite', 'New Site');
   ```

4. **Test the provider**: Use CLI mode for quick testing without Obsidian

## Browser Automation

Providers use Playwright (Chromium) for browser automation:
- Runs in headless mode by default
- Handles authentication, navigation, and HTML parsing
- Selector-based extraction: Use Chrome DevTools to inspect site HTML and identify stable selectors

## Template System

Article formatting uses a simple mustache-like template:
- `{{variable}}`: Replaced with article data
- `{{#if variable}}...{{/if}}`: Conditional blocks
- Implemented in `main.ts` `formatArticle()` method

## File Structure

```
src/
├── main.ts                 # Plugin entry point
├── settings.ts             # Settings UI
├── types.ts                # TypeScript definitions
├── cli.ts                  # Headless CLI tool
├── providers/
│   ├── registry.ts         # Provider registry
│   ├── base.ts             # Base classes
│   ├── wired.ts           # Wired provider
│   ├── guardian.ts        # Guardian provider
│   ├── hbr.ts             # HBR provider
│   ├── medium.ts          # Medium provider
│   └── irishtimes.ts      # Irish Times provider
├── credentials/
│   ├── manager.ts          # Credential resolution manager
│   ├── types.ts            # Credential interfaces
│   └── providers/
│       ├── onepassword.ts  # 1Password CLI integration
│       ├── bitwarden.ts    # Bitwarden CLI integration
│       └── env.ts          # Environment variable provider
├── sync/
│   └── obsidian-sync.ts    # Vault sync and Git integration
└── __tests__/
    └── providers.test.ts   # Unit tests

docs/
├── SETUP-1PASSWORD.md      # 1Password CLI setup guide
└── OBSIDIAN-SYNC.md        # Obsidian Sync integration guide

config.example.json         # Example configuration
config-1password.example.json  # 1Password example
config-env.example.json     # Environment variable example
.env.example                # Environment variables template

manifest.json              # Obsidian plugin manifest
package.json              # Dependencies and scripts
tsconfig.json             # TypeScript config
esbuild.config.mjs        # Build configuration
```

## Credential Management System

### Architecture

The credential system supports multiple providers through a unified interface:

1. **CredentialManager** (`src/credentials/manager.ts`): Central manager that resolves credential references
2. **Credential Providers**: Pluggable providers for different secret managers
   - **OnePasswordProvider**: Integrates with `op` CLI
   - **BitwardenProvider**: Integrates with `bw` CLI
   - **EnvProvider**: Reads from environment variables

### Reference Formats

- 1Password: `op://vault/item/field` (e.g., `op://Private/Wired/username`)
- Bitwarden: `bw://item-name/field` (e.g., `bw://wired-login/username`)
- Environment: `env://VARIABLE_NAME` (e.g., `env://WIRED_USERNAME`)
- Plain text: Just the value (not recommended for production)

### Adding a New Credential Provider

1. Create provider class implementing `CredentialProvider` interface
2. Add to `CredentialManager.registerProviders()`
3. Implement `isAvailable()`, `getCredential()`, `getCredentials()`

Example:
```typescript
export class MySecretProvider implements CredentialProvider {
  name = 'mysecret';

  async isAvailable(): Promise<boolean> {
    // Check if CLI tool is installed
  }

  async getCredential(reference: string): Promise<string | null> {
    // Resolve credential from your secret manager
  }
}
```

## Obsidian Sync Integration

### How It Works

The CLI can write directly to Obsidian vaults:

1. **ObsidianSyncManager** (`src/sync/obsidian-sync.ts`): Handles vault operations
2. **File operations**: `writeFile()`, `appendFile()`, `readFile()`
3. **Sync triggering**: Touches workspace.json to trigger Obsidian Sync
4. **Git integration**: Auto-commit and push if vault is a Git repository

### Vault Detection

- Checks for `.obsidian` directory to validate vault
- Checks for `.git` directory to enable Git features
- Reads `.obsidian/app.json` for vault configuration

### Git Workflow

When `gitSync: true`:
1. Pull latest changes before syncing
2. Write articles to vault
3. Commit changes with descriptive message
4. Push to remote repository

## Common Issues

### Provider Authentication Failing

- Many sites have changed login flows - check browser console logs
- Use Playwright Inspector for debugging: `PWDEBUG=1 node dist/cli.js ...`
- Selectors may need updating if site HTML changes

### Articles Not Extracting

- Inspect the site HTML to verify selector accuracy
- Add `--verbose` flag to CLI to see detailed logs
- Test selectors in browser DevTools first

### Credential Resolution Errors

- Check that CLI tool is installed: `op --version`, `bw --version`
- Verify you're authenticated: `op account list`, `bw unlock --check`
- Test credential references: `op read "op://Private/Wired/username"`
- Use `--list-credential-providers` to see available providers

### Obsidian Sync Not Working

- Verify vault path is correct and contains `.obsidian` directory
- Check file was actually written: `cat /path/to/vault/ReadLater/Clippings.md`
- Ensure Obsidian is running on at least one device
- For Git sync, verify remote is configured: `git remote -v`

### Obsidian API Usage

- Plugin uses official Obsidian API (imported from 'obsidian')
- File operations go through `app.vault` (never use Node.js fs in plugin mode)
- Settings stored via `loadData()` and `saveData()`
- CLI mode uses Node.js fs directly since Obsidian API isn't available

## Security Notes

- Never commit credentials or API keys
- `.gitignore` excludes sensitive files (`.env`, `auth-state/`, `credentials.json`)
- **Plugin mode**: Credentials stored in Obsidian's data.json (encrypted by Obsidian)
- **CLI mode**: Use 1Password CLI, Bitwarden CLI, or environment variables
- Credentials are resolved at runtime and never stored in plain text in config files
- For automation, use service account tokens or Connect servers

## Dependencies

- **obsidian**: Obsidian API (dev only, provided at runtime)
- **playwright**: Browser automation for providers
- **esbuild**: Fast bundler for plugin compilation
- **typescript**: Type checking and compilation
- **jest**: Unit testing framework
