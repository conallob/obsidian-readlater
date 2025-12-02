import { BrowserProvider } from './base';
import { ReadLaterArticle } from '../types';

export class IrishTimesProvider extends BrowserProvider {
  name = 'irishtimes';
  displayName = 'Irish Times';
  loginUrl = 'https://www.irishtimes.com/login';
  readLaterUrl = 'https://www.irishtimes.com/myaccount/saved-articles';

  async performLogin(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await this.page.fill('input[type="email"]', this.config.credentials.username || '');
    await this.page.fill('input[type="password"]', this.config.credentials.password || '');
    await this.page.click('button[type="submit"]');

    await this.page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto(this.readLaterUrl);
      await this.page.waitForSelector('.article-item, .saved-article', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async extractArticles(): Promise<ReadLaterArticle[]> {
    if (!this.page) return [];

    const articles = await this.page.$$eval('.article-item, .saved-article', (elements) => {
      return elements.map(el => {
        const linkEl = el.querySelector('a');
        const titleEl = el.querySelector('h3, h2, .article-title');
        const excerptEl = el.querySelector('.article-excerpt, .intro');
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
      url: article.url.startsWith('http') ? article.url : `https://www.irishtimes.com${article.url}`,
      source: this.displayName,
      addedDate: new Date(),
    }));
  }
}
