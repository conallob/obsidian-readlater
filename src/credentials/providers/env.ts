import { CredentialProvider } from '../types';

export class EnvProvider implements CredentialProvider {
  name = 'env';

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async getCredential(reference: string): Promise<string | null> {
    // Reference is the environment variable name
    const value = process.env[reference];
    return value || null;
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
}
