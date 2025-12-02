import { BrowserProvider } from './base';
import { ReadLaterArticle } from '../types';

export class HBRProvider extends BrowserProvider {
  name = 'hbr';
  displayName = 'Harvard Business Review';
  loginUrl = 'https://hbr.org/sign-in';
  readLaterUrl = 'https://hbr.org/my-library';

  async performLogin(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await this.page.fill('input[name="username"]', this.config.credentials.username || '');
    await this.page.fill('input[name="password"]', this.config.credentials.password || '');
    await this.page.click('button[type="submit"]');

    await this.page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto(this.readLaterUrl);
      await this.page.waitForSelector('.article-item', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async extractArticles(): Promise<ReadLaterArticle[]> {
    if (!this.page) return [];

    const articles = await this.page.$$eval('.article-item', (elements) => {
      return elements.map(el => {
        const linkEl = el.querySelector('a');
        const titleEl = el.querySelector('h3, .article-title');
        const excerptEl = el.querySelector('.article-dek, .dek');
        const authorEl = el.querySelector('.article-author, .author');

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
      url: article.url.startsWith('http') ? article.url : `https://hbr.org${article.url}`,
      source: this.displayName,
      addedDate: new Date(),
    }));
  }
}
