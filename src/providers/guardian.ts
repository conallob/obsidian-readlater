import { BrowserProvider } from './base';
import { ReadLaterArticle } from '../types';

export class GuardianProvider extends BrowserProvider {
  name = 'guardian';
  displayName = 'The Guardian';
  loginUrl = 'https://profile.theguardian.com/signin';
  readLaterUrl = 'https://www.theguardian.com/saved-articles';

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
      await this.page.waitForSelector('.fc-item', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async extractArticles(): Promise<ReadLaterArticle[]> {
    if (!this.page) return [];

    const articles = await this.page.$$eval('.fc-item', (elements) => {
      return elements.map(el => {
        const linkEl = el.querySelector('a.fc-item__link');
        const titleEl = el.querySelector('.fc-item__title');
        const excerptEl = el.querySelector('.fc-item__standfirst');
        const bylineEl = el.querySelector('.fc-item__byline');

        return {
          title: titleEl?.textContent?.trim() || 'Untitled',
          url: linkEl?.getAttribute('href') || '',
          excerpt: excerptEl?.textContent?.trim(),
          author: bylineEl?.textContent?.trim(),
        };
      });
    });

    return articles.map(article => ({
      ...article,
      url: article.url.startsWith('http') ? article.url : `https://www.theguardian.com${article.url}`,
      source: this.displayName,
      addedDate: new Date(),
    }));
  }
}
