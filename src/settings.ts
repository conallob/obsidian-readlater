import { App, PluginSettingTab, Setting } from 'obsidian';
import ReadLaterPlugin from './main';

export const DEFAULT_SETTINGS: ReadLaterSettings = {
  outputFile: 'ReadLater/Clippings.md',
  providers: {},
  syncInterval: 0,
  headlessMode: false,
  appendMode: true,
  dateFormat: 'YYYY-MM-DD',
  template: `## {{title}}
- **Source:** {{source}}
- **URL:** {{url}}
- **Author:** {{author}}
- **Date:** {{date}}
{{#if excerpt}}
- **Excerpt:** {{excerpt}}
{{/if}}
{{#if tags}}
- **Tags:** {{tags}}
{{/if}}

---
`
};

export class ReadLaterSettingTab extends PluginSettingTab {
  plugin: ReadLaterPlugin;

  constructor(app: App, plugin: ReadLaterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Read Later Sync Settings' });

    // Output file setting
    new Setting(containerEl)
      .setName('Output file')
      .setDesc('Path to the file where articles will be saved')
      .addText(text => text
        .setPlaceholder('ReadLater/Clippings.md')
        .setValue(this.plugin.settings.outputFile)
        .onChange(async (value) => {
          this.plugin.settings.outputFile = value;
          await this.plugin.saveSettings();
        }));

    // Append mode
    new Setting(containerEl)
      .setName('Append mode')
      .setDesc('Append new articles to existing file (vs replacing)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.appendMode)
        .onChange(async (value) => {
          this.plugin.settings.appendMode = value;
          await this.plugin.saveSettings();
        }));

    // Sync interval
    new Setting(containerEl)
      .setName('Auto-sync interval')
      .setDesc('Automatically sync every X minutes (0 = manual only)')
      .addText(text => text
        .setPlaceholder('0')
        .setValue(String(this.plugin.settings.syncInterval))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue >= 0) {
            this.plugin.settings.syncInterval = numValue;
            await this.plugin.saveSettings();
            this.plugin.updateSyncInterval();
          }
        }));

    // Headless mode
    new Setting(containerEl)
      .setName('Headless mode')
      .setDesc('Enable headless browser automation (requires Playwright)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.headlessMode)
        .onChange(async (value) => {
          this.plugin.settings.headlessMode = value;
          await this.plugin.saveSettings();
        }));

    // Provider settings
    containerEl.createEl('h3', { text: 'News Site Providers' });

    this.addProviderSettings('wired', 'Wired.com');
    this.addProviderSettings('guardian', 'The Guardian');
    this.addProviderSettings('hbr', 'Harvard Business Review');
    this.addProviderSettings('medium', 'Medium');
    this.addProviderSettings('irishtimes', 'Irish Times');
  }

  private addProviderSettings(providerId: string, displayName: string): void {
    const { containerEl } = this;

    const providerConfig = this.plugin.settings.providers[providerId] || {
      enabled: false,
      credentials: {}
    };

    new Setting(containerEl)
      .setName(displayName)
      .setDesc(`Enable syncing from ${displayName}`)
      .addToggle(toggle => toggle
        .setValue(providerConfig.enabled)
        .onChange(async (value) => {
          if (!this.plugin.settings.providers[providerId]) {
            this.plugin.settings.providers[providerId] = {
              enabled: value,
              credentials: {}
            };
          } else {
            this.plugin.settings.providers[providerId].enabled = value;
          }
          await this.plugin.saveSettings();
        }));

    if (providerConfig.enabled) {
      new Setting(containerEl)
        .setName(`${displayName} - Username/Email`)
        .addText(text => text
          .setPlaceholder('username or email')
          .setValue(providerConfig.credentials.username || '')
          .onChange(async (value) => {
            this.plugin.settings.providers[providerId].credentials.username = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName(`${displayName} - Password`)
        .addText(text => {
          text.inputEl.type = 'password';
          text
            .setPlaceholder('password')
            .setValue(providerConfig.credentials.password || '')
            .onChange(async (value) => {
              this.plugin.settings.providers[providerId].credentials.password = value;
              await this.plugin.saveSettings();
            });
        });
    }
  }
}

import type { ReadLaterSettings } from './types';
