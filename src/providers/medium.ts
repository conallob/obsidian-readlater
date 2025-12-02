import { BrowserProvider } from './base';
import { ReadLaterArticle } from '../types';

export class MediumProvider extends BrowserProvider {
  name = 'medium';
  displayName = 'Medium';
  loginUrl = 'https://medium.com/m/signin';
  readLaterUrl = 'https://medium.com/m/lists/reading-list';

  async performLogin(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // Medium uses email-based sign-in (magic link)
    await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await this.page.fill('input[type="email"]', this.config.credentials.username || '');
    await this.page.click('button[type="submit"]');

    // Note: Medium typically sends a magic link via email
    // For automated access, users may need to use session tokens
    await this.page.waitForTimeout(2000);
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto(this.readLaterUrl);
      await this.page.waitForSelector('article', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async extractArticles(): Promise<ReadLaterArticle[]> {
    if (!this.page) return [];

    const articles = await this.page.$$eval('article', (elements) => {
      return elements.map(el => {
        const linkEl = el.querySelector('a[data-post-id]');
        const titleEl = el.querySelector('h2, h3');
        const excerptEl = el.querySelector('h3 + div, .subtitle');
        const authorEl = el.querySelector('[data-testid="authorName"], .author a');

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
      url: article.url.startsWith('http') ? article.url : `https://medium.com${article.url}`,
      source: this.displayName,
      addedDate: new Date(),
    }));
  }
}
