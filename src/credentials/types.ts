export interface CredentialProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  getCredential(reference: string): Promise<string | null>;
  getCredentials(references: Record<string, string>): Promise<Record<string, string>>;
}

export interface CredentialReference {
  provider: 'env' | '1password' | 'bitwarden' | 'plain';
  reference: string;
}

export interface SecureProviderConfig {
  enabled: boolean;
  credentials: {
    username?: string | CredentialReference;
    password?: string | CredentialReference;
    apiKey?: string | CredentialReference;
  };
  lastSync?: Date;
}
