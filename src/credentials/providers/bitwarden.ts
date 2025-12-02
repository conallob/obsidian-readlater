import { CredentialProvider } from '../types';
import { execSync } from 'child_process';

export class BitwardenProvider implements CredentialProvider {
  name = 'bitwarden';

  async isAvailable(): Promise<boolean> {
    try {
      execSync('bw --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getCredential(reference: string): Promise<string | null> {
    try {
      // Reference format: bw://item-name/field-name
      const match = reference.match(/^bw:\/\/([^/]+)\/(.+)$/);
      if (!match) {
        console.error(`Invalid Bitwarden reference format: ${reference}`);
        return null;
      }

      const [, itemName, fieldName] = match;

      // Get item
      const result = execSync(`bw get item "${itemName}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });

      const item = JSON.parse(result);

      // Extract field
      if (fieldName === 'username' && item.login?.username) {
        return item.login.username;
      }

      if (fieldName === 'password' && item.login?.password) {
        return item.login.password;
      }

      // Check custom fields
      if (item.fields) {
        const field = item.fields.find((f: any) => f.name === fieldName);
        if (field) {
          return field.value;
        }
      }

      console.error(`Field '${fieldName}' not found in Bitwarden item '${itemName}'`);
      return null;
    } catch (error) {
      console.error(`Failed to read Bitwarden credential: ${reference}`, error);
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
   * Helper to check if user is logged in and unlocked
   */
  async isUnlocked(): Promise<boolean> {
    try {
      execSync('bw unlock --check', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
