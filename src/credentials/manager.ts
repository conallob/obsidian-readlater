import { CredentialProvider, CredentialReference } from './types';
import { OnePasswordProvider } from './providers/onepassword';
import { BitwardenProvider } from './providers/bitwarden';
import { EnvProvider } from './providers/env';

export class CredentialManager {
  private providers: Map<string, CredentialProvider>;

  constructor() {
    this.providers = new Map();
    this.registerProviders();
  }

  private registerProviders(): void {
    this.providers.set('1password', new OnePasswordProvider());
    this.providers.set('bitwarden', new BitwardenProvider());
    this.providers.set('env', new EnvProvider());
  }

  async getProvider(name: string): Promise<CredentialProvider | null> {
    const provider = this.providers.get(name);
    if (!provider) return null;

    const available = await provider.isAvailable();
    return available ? provider : null;
  }

  async resolveCredential(value: string | CredentialReference): Promise<string> {
    // Plain string - return as-is
    if (typeof value === 'string') {
      return value;
    }

    // Credential reference - resolve it
    const provider = await this.getProvider(value.provider);
    if (!provider) {
      throw new Error(`Credential provider '${value.provider}' not available`);
    }

    const credential = await provider.getCredential(value.reference);
    if (!credential) {
      throw new Error(`Failed to resolve credential: ${value.reference}`);
    }

    return credential;
  }

  async resolveCredentials(
    credentials: Record<string, string | CredentialReference>
  ): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};

    for (const [key, value] of Object.entries(credentials)) {
      if (value) {
        resolved[key] = await this.resolveCredential(value);
      }
    }

    return resolved;
  }

  /**
   * Parse credential reference from string format
   * Formats:
   *   - op://vault/item/field
   *   - bw://item/field
   *   - env://VARIABLE_NAME
   */
  parseReference(ref: string): CredentialReference | string {
    if (ref.startsWith('op://')) {
      return {
        provider: '1password',
        reference: ref
      };
    }

    if (ref.startsWith('bw://')) {
      return {
        provider: 'bitwarden',
        reference: ref
      };
    }

    if (ref.startsWith('env://')) {
      return {
        provider: 'env',
        reference: ref.replace('env://', '')
      };
    }

    // Plain string
    return ref;
  }

  async listAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }

    return available;
  }
}
