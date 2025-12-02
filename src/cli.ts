#!/usr/bin/env node

/**
 * Headless CLI for syncing read-later articles without Obsidian desktop app
 *
 * Usage:
 *   readlater-sync --config config.json --output output.md
 *   readlater-sync --provider wired --username user@email.com --password pass123
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { ProviderRegistry } from './providers/registry';
import { ReadLaterSettings, ReadLaterArticle, SyncResult } from './types';
import { CredentialManager } from './credentials/manager';
import { ObsidianSyncManager } from './sync/obsidian-sync';

interface CLIOptions {
  config?: string;
  output?: string;
  provider?: string;
  username?: string;
  password?: string;
  append?: boolean;
  verbose?: boolean;
  vault?: string;
  gitSync?: boolean;
  listCredentialProviders?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--config':
        options.config = next;
        i++;
        break;
      case '--output':
        options.output = next;
        i++;
        break;
      case '--provider':
        options.provider = next;
        i++;
        break;
      case '--username':
        options.username = next;
        i++;
        break;
      case '--password':
        options.password = next;
        i++;
        break;
      case '--append':
        options.append = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--vault':
        options.vault = next;
        i++;
        break;
      case '--git-sync':
        options.gitSync = true;
        break;
      case '--list-credential-providers':
        options.listCredentialProviders = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Read Later Sync - Headless CLI

Usage:
  readlater-sync --config config.json
  readlater-sync --provider wired --username user@example.com --password pass123 --output articles.md
  readlater-sync --config config.json --vault /path/to/vault --git-sync

Options:
  --config <file>                Path to configuration JSON file
  --output <file>                Output file path (default: stdout)
  --vault <path>                 Obsidian vault path (enables Obsidian Sync integration)
  --git-sync                     Auto-commit and push changes to Git
  --provider <name>              Provider name (wired, guardian, hbr, medium, irishtimes)
  --username <email>             Login username/email (or credential reference)
  --password <pass>              Login password (or credential reference)
  --append                       Append to output file instead of replacing
  --verbose, -v                  Verbose output
  --list-credential-providers    List available credential managers
  --help, -h                     Show this help message

Credential References:
  Instead of plain text credentials, use references to secret managers:

  1Password:
    "username": "op://vault/item/field"
    Example: "op://Private/Wired/username"

  Bitwarden:
    "username": "bw://item-name/field"
    Example: "bw://wired-login/username"

  Environment Variables:
    "username": "env://WIRED_USERNAME"

Configuration File Format:
  {
    "outputFile": "ReadLater/Clippings.md",
    "appendMode": true,
    "vaultPath": "/Users/name/Documents/MyVault",
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
          "username": "env://GUARDIAN_USER",
          "password": "env://GUARDIAN_PASS"
        }
      }
    }
  }

Examples:
  # Use 1Password CLI for credentials
  readlater-sync --config config.json --vault ~/Documents/MyVault

  # Use environment variables
  export WIRED_USER="user@example.com"
  export WIRED_PASS="password"
  readlater-sync --provider wired --username "env://WIRED_USER" --password "env://WIRED_PASS"

  # Sync to vault with Git auto-commit
  readlater-sync --config config.json --vault ~/Documents/MyVault --git-sync
`);
}

async function loadConfig(configPath: string): Promise<ReadLaterSettings> {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Merge with defaults
  return {
    outputFile: config.outputFile || 'output.md',
    providers: config.providers || {},
    syncInterval: 0,
    headlessMode: true,
    appendMode: config.appendMode !== undefined ? config.appendMode : true,
    dateFormat: config.dateFormat || 'YYYY-MM-DD',
    template: config.template || `## {{title}}
- **Source:** {{source}}
- **URL:** {{url}}
- **Author:** {{author}}
- **Date:** {{date}}
{{#if excerpt}}
- **Excerpt:** {{excerpt}}
{{/if}}

---
`
  };
}

function formatArticle(article: ReadLaterArticle, template: string): string {
  let result = template;

  result = result.replace(/{{title}}/g, article.title || 'Untitled');
  result = result.replace(/{{url}}/g, article.url);
  result = result.replace(/{{source}}/g, article.source);
  result = result.replace(/{{author}}/g, article.author || 'Unknown');
  result = result.replace(/{{date}}/g, article.publicationDate || '');

  // Handle conditional blocks
  if (article.excerpt) {
    result = result.replace(/{{#if excerpt}}([\s\S]*?){{\/if}}/g, '$1');
    result = result.replace(/{{excerpt}}/g, article.excerpt);
  } else {
    result = result.replace(/{{#if excerpt}}[\s\S]*?{{\/if}}/g, '');
  }

  if (article.tags && article.tags.length > 0) {
    result = result.replace(/{{#if tags}}([\s\S]*?){{\/if}}/g, '$1');
    result = result.replace(/{{tags}}/g, article.tags.join(', '));
  } else {
    result = result.replace(/{{#if tags}}[\s\S]*?{{\/if}}/g, '');
  }

  return result;
}

async function saveArticles(
  articles: ReadLaterArticle[],
  outputPath: string,
  append: boolean,
  template: string
): Promise<void> {
  const formatted = articles.map(article => formatArticle(article, template)).join('\n');

  if (!outputPath || outputPath === '-') {
    console.log(formatted);
    return;
  }

  // Create directory if it doesn't exist
  const dir = dirname(outputPath);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (append && existsSync(outputPath)) {
    const existing = readFileSync(outputPath, 'utf-8');
    writeFileSync(outputPath, existing + '\n\n' + formatted);
  } else {
    writeFileSync(outputPath, formatted);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  // List credential providers if requested
  if (options.listCredentialProviders) {
    const credManager = new CredentialManager();
    const available = await credManager.listAvailableProviders();

    console.log('Available credential providers:');
    for (const provider of available) {
      console.log(`  - ${provider}`);
    }

    if (available.length === 0) {
      console.log('  (none available - install 1Password CLI or Bitwarden CLI)');
    }

    process.exit(0);
  }

  let settings: ReadLaterSettings;
  let vaultPath: string | null = null;
  let useGitSync = false;

  if (options.config) {
    // Load from config file
    const rawConfig = JSON.parse(readFileSync(options.config, 'utf-8'));

    // Extract vault and git settings
    vaultPath = rawConfig.vaultPath || options.vault || null;
    useGitSync = rawConfig.gitSync || options.gitSync || false;

    settings = await loadConfig(options.config);

    if (options.output) {
      settings.outputFile = options.output;
    }
    if (options.append !== undefined) {
      settings.appendMode = options.append;
    }
  } else if (options.provider && options.username && options.password) {
    // Use command-line arguments
    vaultPath = options.vault || null;
    useGitSync = options.gitSync || false;

    settings = {
      outputFile: options.output || '-',
      providers: {
        [options.provider]: {
          enabled: true,
          credentials: {
            username: options.username,
            password: options.password
          }
        }
      },
      syncInterval: 0,
      headlessMode: true,
      appendMode: options.append || false,
      dateFormat: 'YYYY-MM-DD',
      template: `## {{title}}
- **Source:** {{source}}
- **URL:** {{url}}
- **Author:** {{author}}

---
`
    };
  } else {
    console.error('Error: Must provide either --config or --provider with credentials');
    printHelp();
    process.exit(1);
  }

  // Resolve credentials using credential manager
  const credManager = new CredentialManager();

  for (const [providerName, providerConfig] of Object.entries(settings.providers)) {
    if (!providerConfig.enabled) continue;

    const creds = providerConfig.credentials;
    const resolvedCreds: Record<string, string> = {};

    for (const [key, value] of Object.entries(creds)) {
      if (typeof value === 'string') {
        const parsed = credManager.parseReference(value);
        resolvedCreds[key] = await credManager.resolveCredential(parsed);
      }
    }

    // Update with resolved credentials
    providerConfig.credentials = resolvedCreds;
  }

  if (options.verbose) {
    console.log('Starting sync with settings:', JSON.stringify({
      ...settings,
      providers: Object.fromEntries(
        Object.entries(settings.providers).map(([k, v]) => [k, { ...v, credentials: '***' }])
      )
    }, null, 2));
  }

  // Initialize Obsidian Sync if vault path provided
  let syncManager: ObsidianSyncManager | null = null;
  if (vaultPath) {
    syncManager = new ObsidianSyncManager({ vaultPath, syncEnabled: true, autoCommit: useGitSync });

    if (!syncManager.isValidVault()) {
      console.error(`Error: Invalid vault path: ${vaultPath}`);
      process.exit(1);
    }

    if (options.verbose) {
      console.log(`Using Obsidian vault: ${vaultPath}`);
      if (syncManager.isGitVault()) {
        console.log('  Git repository detected');
        if (useGitSync) {
          console.log('  Auto-commit and push enabled');
        }
      }
    }

    // Pull latest changes if using Git sync
    if (useGitSync && syncManager.isGitVault()) {
      if (options.verbose) {
        console.log('Pulling latest changes from Git...');
      }
      syncManager.gitPull();
    }
  }

  const registry = new ProviderRegistry(settings);
  const providers = registry.getEnabledProviders();

  if (providers.length === 0) {
    console.error('Error: No providers enabled');
    process.exit(1);
  }

  const results: SyncResult[] = [];
  const allArticles: ReadLaterArticle[] = [];

  for (const provider of providers) {
    try {
      if (options.verbose) {
        console.log(`Authenticating with ${provider.displayName}...`);
      }

      const authenticated = await provider.authenticate();

      if (!authenticated) {
        console.error(`Failed to authenticate with ${provider.displayName}`);
        results.push({
          provider: provider.displayName,
          success: false,
          articlesAdded: 0,
          error: 'Authentication failed'
        });
        continue;
      }

      if (options.verbose) {
        console.log(`Fetching articles from ${provider.displayName}...`);
      }

      const articles = await provider.fetchArticles();
      allArticles.push(...articles);

      results.push({
        provider: provider.displayName,
        success: true,
        articlesAdded: articles.length
      });

      if (options.verbose) {
        console.log(`Fetched ${articles.length} articles from ${provider.displayName}`);
      }

    } catch (error) {
      console.error(`Error with ${provider.displayName}:`, error);
      results.push({
        provider: provider.displayName,
        success: false,
        articlesAdded: 0,
        error: error.message
      });
    }
  }

  // Save articles
  if (allArticles.length > 0) {
    const formatted = allArticles.map(article => formatArticle(article, settings.template)).join('\n');

    // Use sync manager if vault is configured, otherwise fall back to direct file write
    if (syncManager) {
      const relativePath = settings.outputFile;

      if (settings.appendMode) {
        syncManager.appendFile(relativePath, formatted);
      } else {
        syncManager.writeFile(relativePath, formatted);
      }

      if (options.verbose) {
        console.log(`Wrote to vault: ${relativePath}`);
      }

      // Trigger Obsidian Sync
      syncManager.triggerSync();

      // Git commit and push if enabled
      if (useGitSync && syncManager.isGitVault()) {
        const commitMsg = `chore: sync read-later articles (${allArticles.length} articles)`;

        if (syncManager.gitCommit(commitMsg, [relativePath])) {
          if (options.verbose) {
            console.log('Changes committed to Git');
          }

          if (syncManager.gitPush()) {
            if (options.verbose) {
              console.log('Changes pushed to remote');
            }
          }
        }
      }
    } else {
      // Direct file write (no vault)
      await saveArticles(
        allArticles,
        settings.outputFile,
        settings.appendMode,
        settings.template
      );
    }

    console.log(`\nSync complete: ${allArticles.length} articles saved`);
  } else {
    console.log('\nNo articles found');
  }

  // Print summary
  console.log('\nResults:');
  for (const result of results) {
    const status = result.success ? '✓' : '✗';
    console.log(`  ${status} ${result.provider}: ${result.articlesAdded} articles`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  const failures = results.filter(r => !r.success).length;
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
