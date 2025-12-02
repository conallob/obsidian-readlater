import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

export interface ObsidianVaultConfig {
  vaultPath: string;
  syncEnabled?: boolean;
  autoCommit?: boolean;
}

export class ObsidianSyncManager {
  constructor(private config: ObsidianVaultConfig) {}

  /**
   * Verify the vault path exists and is a valid Obsidian vault
   */
  isValidVault(): boolean {
    if (!existsSync(this.config.vaultPath)) {
      return false;
    }

    // Check for .obsidian directory
    const obsidianDir = join(this.config.vaultPath, '.obsidian');
    return existsSync(obsidianDir);
  }

  /**
   * Get the full path to a file within the vault
   */
  getFilePath(relativePath: string): string {
    return join(this.config.vaultPath, relativePath);
  }

  /**
   * Write content to a file in the vault
   * Ensures parent directories exist
   */
  writeFile(relativePath: string, content: string): void {
    const fullPath = this.getFilePath(relativePath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
  }

  /**
   * Append content to a file in the vault
   */
  appendFile(relativePath: string, content: string): void {
    const fullPath = this.getFilePath(relativePath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let existing = '';
    if (existsSync(fullPath)) {
      existing = readFileSync(fullPath, 'utf-8');
    }

    const newContent = existing ? existing + '\n\n' + content : content;
    writeFileSync(fullPath, newContent, 'utf-8');
  }

  /**
   * Read a file from the vault
   */
  readFile(relativePath: string): string | null {
    const fullPath = this.getFilePath(relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    return readFileSync(fullPath, 'utf-8');
  }

  /**
   * Check if vault uses Git sync (alternative to Obsidian Sync)
   */
  isGitVault(): boolean {
    const gitDir = join(this.config.vaultPath, '.git');
    return existsSync(gitDir);
  }

  /**
   * Commit changes to Git (if vault is a Git repository)
   */
  gitCommit(message: string, files?: string[]): boolean {
    if (!this.isGitVault()) {
      return false;
    }

    try {
      const cwd = this.config.vaultPath;

      if (files && files.length > 0) {
        // Add specific files
        for (const file of files) {
          execSync(`git add "${file}"`, { cwd, stdio: 'ignore' });
        }
      } else {
        // Add all changes
        execSync('git add -A', { cwd, stdio: 'ignore' });
      }

      // Check if there are changes to commit
      try {
        execSync('git diff-index --quiet HEAD --', { cwd, stdio: 'ignore' });
        // No changes to commit
        return false;
      } catch {
        // Changes exist, proceed with commit
      }

      execSync(`git commit -m "${message}"`, { cwd, stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Git commit failed:', error);
      return false;
    }
  }

  /**
   * Push changes to remote (if vault is a Git repository)
   */
  gitPush(): boolean {
    if (!this.isGitVault()) {
      return false;
    }

    try {
      execSync('git push', { cwd: this.config.vaultPath, stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Git push failed:', error);
      return false;
    }
  }

  /**
   * Pull changes from remote (if vault is a Git repository)
   */
  gitPull(): boolean {
    if (!this.isGitVault()) {
      return false;
    }

    try {
      execSync('git pull', { cwd: this.config.vaultPath, stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Git pull failed:', error);
      return false;
    }
  }

  /**
   * Get file modification time
   */
  getFileModTime(relativePath: string): Date | null {
    const fullPath = this.getFilePath(relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    const stats = statSync(fullPath);
    return stats.mtime;
  }

  /**
   * Create a backup of a file before modifying
   */
  createBackup(relativePath: string): string | null {
    const fullPath = this.getFilePath(relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${fullPath}.backup-${timestamp}`;

    const content = readFileSync(fullPath, 'utf-8');
    writeFileSync(backupPath, content, 'utf-8');

    return backupPath;
  }

  /**
   * Touch the .obsidian/workspace.json file to trigger Obsidian Sync
   * This is a workaround to ensure Obsidian Sync picks up changes
   */
  triggerSync(): void {
    const workspaceFile = join(this.config.vaultPath, '.obsidian', 'workspace.json');

    if (existsSync(workspaceFile)) {
      const now = new Date();
      try {
        // Update access and modification time
        const fd = require('fs').openSync(workspaceFile, 'a');
        require('fs').futimesSync(fd, now, now);
        require('fs').closeSync(fd);
      } catch (error) {
        console.error('Failed to trigger sync:', error);
      }
    }
  }

  /**
   * Get vault configuration from .obsidian/app.json
   */
  getVaultConfig(): any {
    const configPath = join(this.config.vaultPath, '.obsidian', 'app.json');

    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Check if Obsidian Sync is enabled for this vault
   * Note: This is a best-effort check; actual sync status requires Obsidian API
   */
  isSyncEnabled(): boolean {
    const config = this.getVaultConfig();
    // This is a heuristic; actual sync status may vary
    return config !== null;
  }
}
