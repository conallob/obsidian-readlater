import { Notice, Plugin, TFile } from 'obsidian';
import { ReadLaterSettingTab, DEFAULT_SETTINGS } from './settings';
import { ReadLaterSettings, ReadLaterArticle, SyncResult } from './types';
import { ProviderRegistry } from './providers/registry';

export default class ReadLaterPlugin extends Plugin {
  settings: ReadLaterSettings;
  providerRegistry: ProviderRegistry;
  syncInterval: number | null = null;

  async onload() {
    await this.loadSettings();

    this.providerRegistry = new ProviderRegistry(this.settings);

    // Add ribbon icon
    this.addRibbonIcon('download-cloud', 'Sync Read Later', async () => {
      await this.syncAllProviders();
    });

    // Add command for manual sync
    this.addCommand({
      id: 'sync-readlater',
      name: 'Sync all read-later lists',
      callback: async () => {
        await this.syncAllProviders();
      }
    });

    // Add command for individual provider sync
    this.addCommand({
      id: 'sync-readlater-provider',
      name: 'Sync specific provider',
      callback: async () => {
        // TODO: Add provider selection modal
        await this.syncAllProviders();
      }
    });

    // Add settings tab
    this.addSettingTab(new ReadLaterSettingTab(this.app, this));

    // Start auto-sync if configured
    this.updateSyncInterval();

    console.log('Read Later Sync plugin loaded');
  }

  onunload() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }
    console.log('Read Later Sync plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  updateSyncInterval() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.settings.syncInterval > 0) {
      this.syncInterval = window.setInterval(
        () => this.syncAllProviders(),
        this.settings.syncInterval * 60 * 1000
      );
    }
  }

  async syncAllProviders(): Promise<void> {
    const notice = new Notice('Syncing read-later lists...', 0);
    const results: SyncResult[] = [];

    try {
      const providers = this.providerRegistry.getEnabledProviders();

      if (providers.length === 0) {
        notice.hide();
        new Notice('No providers enabled. Check settings.');
        return;
      }

      for (const provider of providers) {
        try {
          const authenticated = await provider.authenticate();

          if (!authenticated) {
            results.push({
              provider: provider.displayName,
              success: false,
              articlesAdded: 0,
              error: 'Authentication failed'
            });
            continue;
          }

          const articles = await provider.fetchArticles();
          await this.saveArticles(articles);

          results.push({
            provider: provider.displayName,
            success: true,
            articlesAdded: articles.length,
          });

          // Update last sync time
          const providerConfig = this.settings.providers[provider.name];
          if (providerConfig) {
            providerConfig.lastSync = new Date();
            await this.saveSettings();
          }

        } catch (error) {
          results.push({
            provider: provider.displayName,
            success: false,
            articlesAdded: 0,
            error: error.message
          });
        }
      }

      notice.hide();
      this.showSyncResults(results);

    } catch (error) {
      notice.hide();
      new Notice(`Sync failed: ${error.message}`);
      console.error('Sync error:', error);
    }
  }

  private showSyncResults(results: SyncResult[]): void {
    const totalArticles = results.reduce((sum, r) => sum + r.articlesAdded, 0);
    const failures = results.filter(r => !r.success);

    let message = `Synced ${totalArticles} articles`;

    if (failures.length > 0) {
      message += `\n${failures.length} provider(s) failed`;
    }

    new Notice(message, 5000);

    // Log detailed results
    console.log('Sync results:', results);
  }

  async saveArticles(articles: ReadLaterArticle[]): Promise<void> {
    if (articles.length === 0) {
      return;
    }

    const filePath = this.settings.outputFile;
    let file = this.app.vault.getAbstractFileByPath(filePath);

    // Create file if it doesn't exist
    if (!file) {
      const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
      if (folderPath) {
        await this.app.vault.createFolder(folderPath).catch(() => {});
      }
      file = await this.app.vault.create(filePath, '');
    }

    if (!(file instanceof TFile)) {
      throw new Error(`${filePath} is not a file`);
    }

    const formattedArticles = articles.map(article =>
      this.formatArticle(article)
    ).join('\n');

    if (this.settings.appendMode) {
      const existingContent = await this.app.vault.read(file);
      const newContent = existingContent
        ? existingContent + '\n\n' + formattedArticles
        : formattedArticles;
      await this.app.vault.modify(file, newContent);
    } else {
      await this.app.vault.modify(file, formattedArticles);
    }
  }

  private formatArticle(article: ReadLaterArticle): string {
    let template = this.settings.template;

    // Simple template replacement
    template = template.replace(/{{title}}/g, article.title || 'Untitled');
    template = template.replace(/{{url}}/g, article.url);
    template = template.replace(/{{source}}/g, article.source);
    template = template.replace(/{{author}}/g, article.author || 'Unknown');
    template = template.replace(/{{date}}/g, article.publicationDate || '');

    // Handle conditional blocks
    if (article.excerpt) {
      template = template.replace(/{{#if excerpt}}([\s\S]*?){{\/if}}/g, '$1');
      template = template.replace(/{{excerpt}}/g, article.excerpt);
    } else {
      template = template.replace(/{{#if excerpt}}[\s\S]*?{{\/if}}/g, '');
    }

    if (article.tags && article.tags.length > 0) {
      template = template.replace(/{{#if tags}}([\s\S]*?){{\/if}}/g, '$1');
      template = template.replace(/{{tags}}/g, article.tags.join(', '));
    } else {
      template = template.replace(/{{#if tags}}[\s\S]*?{{\/if}}/g, '');
    }

    return template;
  }
}
