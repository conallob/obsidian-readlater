import { ReadLaterProvider, ReadLaterSettings } from '../types';
import { WiredProvider } from './wired';
import { GuardianProvider } from './guardian';
import { HBRProvider } from './hbr';
import { MediumProvider } from './medium';
import { IrishTimesProvider } from './irishtimes';

export class ProviderRegistry {
  private providers: Map<string, new (config: any) => ReadLaterProvider>;

  constructor(private settings: ReadLaterSettings) {
    this.providers = new Map();
    this.registerProviders();
  }

  private registerProviders(): void {
    this.register('wired', WiredProvider);
    this.register('guardian', GuardianProvider);
    this.register('hbr', HBRProvider);
    this.register('medium', MediumProvider);
    this.register('irishtimes', IrishTimesProvider);
  }

  private register(name: string, providerClass: new (config: any) => ReadLaterProvider): void {
    this.providers.set(name, providerClass);
  }

  getEnabledProviders(): ReadLaterProvider[] {
    const enabled: ReadLaterProvider[] = [];

    for (const [name, ProviderClass] of this.providers.entries()) {
      const config = this.settings.providers[name];
      if (config && config.enabled) {
        enabled.push(new ProviderClass(config));
      }
    }

    return enabled;
  }

  getProvider(name: string): ReadLaterProvider | null {
    const ProviderClass = this.providers.get(name);
    const config = this.settings.providers[name];

    if (!ProviderClass || !config) {
      return null;
    }

    return new ProviderClass(config);
  }

  getAllProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }
}
