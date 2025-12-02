import { CredentialProvider } from '../types';
import { execSync } from 'child_process';

export class OnePasswordProvider implements CredentialProvider {
  name = '1password';

  async isAvailable(): Promise<boolean> {
    try {
      execSync('op --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getCredential(reference: string): Promise<string | null> {
    try {
      // Reference format: op://vault/item/field
      // or op://vault/item/section/field
      const result = execSync(`op read "${reference}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });

      return result.trim();
    } catch (error) {
      console.error(`Failed to read 1Password credential: ${reference}`, error);
      return null;
    }
  }

  async getCredentials(references: Record<string, string>): Promise<Record<string, string>> {
    const credentials: Record<string, string> = {};

    for (const [key, ref] of Object.entries(references)) {
      const value = await this.getCredential(ref);
      if (value) {
        credentials[key] = value;
      }
    }

    return credentials;
  }

  /**
   * Helper to check if user is signed in to 1Password CLI
   */
  async isSignedIn(): Promise<boolean> {
    try {
      execSync('op account list', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper to get item details (useful for discovery)
   */
  async getItem(itemName: string, vault?: string): Promise<any> {
    try {
      const vaultFlag = vault ? `--vault "${vault}"` : '';
      const result = execSync(`op item get "${itemName}" ${vaultFlag} --format json`, {
        encoding: 'utf-8'
      });

      return JSON.parse(result);
    } catch (error) {
      console.error(`Failed to get 1Password item: ${itemName}`, error);
      return null;
    }
  }
}
