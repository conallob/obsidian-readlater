import { ReadLaterProvider, ReadLaterArticle, ProviderConfig } from '../types';
import { Browser, Page, chromium } from 'playwright';

export abstract class BrowserProvider extends ReadLaterProvider {
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  abstract loginUrl: string;
  abstract readLaterUrl: string;

  async authenticate(): Promise<boolean> {
    try {
      this.browser = await chromium.launch({ headless: true });
      this.page = await this.browser.newPage();

      await this.page.goto(this.loginUrl);
      await this.performLogin();

      return await this.isAuthenticated();
    } catch (error) {
      console.error(`Authentication failed for ${this.displayName}:`, error);
      return false;
    }
  }

  abstract performLogin(): Promise<void>;
  abstract isAuthenticated(): Promise<boolean>;
  abstract extractArticles(): Promise<ReadLaterArticle[]>;

  async fetchArticles(): Promise<ReadLaterArticle[]> {
    if (!this.page) {
      throw new Error('Not authenticated');
    }

    await this.page.goto(this.readLaterUrl);
    const articles = await this.extractArticles();

    await this.cleanup();
    return articles;
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  supportsHeadless(): boolean {
    return true;
  }

  requiresCredentials(): string[] {
    return ['username', 'password'];
  }
}

export abstract class APIProvider extends ReadLaterProvider {
  abstract apiBaseUrl: string;

  async authenticate(): Promise<boolean> {
    // Most API providers use API keys or tokens
    return !!this.config.credentials.apiKey;
  }

  abstract fetchArticles(): Promise<ReadLaterArticle[]>;

  supportsHeadless(): boolean {
    return true;
  }

  requiresCredentials(): string[] {
    return ['apiKey'];
  }
}
