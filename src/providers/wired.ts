import { BrowserProvider } from './base';
import { ReadLaterArticle } from '../types';

export class WiredProvider extends BrowserProvider {
  name = 'wired';
  displayName = 'Wired.com';
  loginUrl = 'https://www.wired.com/account/sign-in';
  readLaterUrl = 'https://www.wired.com/saved-stories';

  async performLogin(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for login form
    await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Enter credentials
    await this.page.fill('input[type="email"]', this.config.credentials.username || '');
    await this.page.click('button[type="submit"]');

    // Wait for password field
    await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await this.page.fill('input[type="password"]', this.config.credentials.password || '');
    await this.page.click('button[type="submit"]');

    // Wait for redirect after login
    await this.page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check if we can access saved stories
      await this.page.goto(this.readLaterUrl);
      await this.page.waitForSelector('.saved-story', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async extractArticles(): Promise<ReadLaterArticle[]> {
    if (!this.page) return [];

    const articles = await this.page.$$eval('.saved-story', (elements) => {
      return elements.map(el => {
        const titleEl = el.querySelector('h3, h2, .title');
        const linkEl = el.querySelector('a');
        const excerptEl = el.querySelector('.excerpt, .dek');
        const authorEl = el.querySelector('.author, [data-testid="author"]');

        return {
          title: titleEl?.textContent?.trim() || 'Untitled',
          url: linkEl?.getAttribute('href') || '',
          excerpt: excerptEl?.textContent?.trim(),
          author: authorEl?.textContent?.trim(),
        };
      });
    });

    return articles.map(article => ({
      ...article,
      source: this.displayName,
      addedDate: new Date(),
    }));
  }
}
