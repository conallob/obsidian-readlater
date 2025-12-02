import { ProviderRegistry } from '../providers/registry';
import { ReadLaterSettings } from '../types';

describe('ProviderRegistry', () => {
  const mockSettings: ReadLaterSettings = {
    outputFile: 'test.md',
    providers: {
      wired: {
        enabled: true,
        credentials: {
          username: 'test@example.com',
          password: 'password123'
        }
      },
      guardian: {
        enabled: false,
        credentials: {}
      }
    },
    syncInterval: 0,
    headlessMode: true,
    appendMode: true,
    dateFormat: 'YYYY-MM-DD',
    template: '{{title}}'
  };

  test('should return only enabled providers', () => {
    const registry = new ProviderRegistry(mockSettings);
    const providers = registry.getEnabledProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('wired');
  });

  test('should get provider by name', () => {
    const registry = new ProviderRegistry(mockSettings);
    const provider = registry.getProvider('wired');

    expect(provider).not.toBeNull();
    expect(provider?.name).toBe('wired');
  });

  test('should return null for non-existent provider', () => {
    const registry = new ProviderRegistry(mockSettings);
    const provider = registry.getProvider('nonexistent');

    expect(provider).toBeNull();
  });

  test('should list all provider names', () => {
    const registry = new ProviderRegistry(mockSettings);
    const names = registry.getAllProviderNames();

    expect(names).toContain('wired');
    expect(names).toContain('guardian');
    expect(names).toContain('hbr');
    expect(names).toContain('medium');
    expect(names).toContain('irishtimes');
  });
});
