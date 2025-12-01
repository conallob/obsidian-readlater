export interface ReadLaterArticle {
  title: string;
  url: string;
  author?: string;
  publicationDate?: string;
  excerpt?: string;
  source: string;
  addedDate: Date;
  tags?: string[];
}

export interface ProviderCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  sessionToken?: string;
}

export interface ProviderConfig {
  enabled: boolean;
  credentials: ProviderCredentials;
  lastSync?: Date;
}

export interface ReadLaterSettings {
  outputFile: string;
  providers: {
    [key: string]: ProviderConfig;
  };
  syncInterval: number; // in minutes, 0 = manual only
  headlessMode: boolean;
  appendMode: boolean; // true = append to file, false = replace
  dateFormat: string;
  template: string;
}

export interface SyncResult {
  provider: string;
  success: boolean;
  articlesAdded: number;
  error?: string;
}

export abstract class ReadLaterProvider {
  abstract name: string;
  abstract displayName: string;

  constructor(protected config: ProviderConfig) {}

  abstract authenticate(): Promise<boolean>;
  abstract fetchArticles(): Promise<ReadLaterArticle[]>;
  abstract requiresCredentials(): string[];
  abstract supportsHeadless(): boolean;
}
