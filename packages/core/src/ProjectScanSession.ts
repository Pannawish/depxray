import * as path from 'node:path';
import { scanProject } from './scanProject.js';
import type {
  ScanAnalysisCache,
  ScanAnalysisCacheEntry,
  ScanOptions,
  ScanResult,
} from './types.js';

export interface ScanSessionStats {
  entries: number;
  hits: number;
  misses: number;
}

class MemoryScanAnalysisCache implements ScanAnalysisCache {
  private readonly entries = new Map<string, ScanAnalysisCacheEntry>();
  private hits = 0;
  private misses = 0;

  get(filePath: string, signature: string): ScanAnalysisCacheEntry | undefined {
    const entry = this.entries.get(filePath);
    if (entry?.signature === signature) {
      this.hits += 1;
      return entry;
    }

    this.misses += 1;
    if (entry) {
      this.entries.delete(filePath);
    }
    return undefined;
  }

  set(filePath: string, entry: ScanAnalysisCacheEntry): void {
    this.entries.set(filePath, entry);
  }

  delete(filePath: string): void {
    this.entries.delete(filePath);
  }

  retain(filePaths: ReadonlySet<string>): void {
    for (const filePath of this.entries.keys()) {
      if (!filePaths.has(filePath)) {
        this.entries.delete(filePath);
      }
    }
  }

  stats(): ScanSessionStats {
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Reusable scanner for watch processes and long-lived integrations.
 * Unchanged files reuse their parsed imports, exports, and metrics while graph
 * resolution and project-level checks are recomputed from current options.
 */
export class ProjectScanSession {
  readonly rootDir: string;
  private readonly baseOptions: ScanOptions;
  private readonly cache = new MemoryScanAnalysisCache();

  constructor(options: ScanOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.baseOptions = { ...options, rootDir: this.rootDir };
  }

  scan(overrides: Partial<Omit<ScanOptions, 'rootDir' | 'analysisCache'>> = {}): Promise<ScanResult> {
    return scanProject({
      ...this.baseOptions,
      ...overrides,
      rootDir: this.rootDir,
      analysisCache: this.cache,
    });
  }

  invalidate(filePath: string): void {
    const absolutePath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.rootDir, filePath);
    this.cache.delete(absolutePath);
  }

  getStats(): ScanSessionStats {
    return this.cache.stats();
  }

  resetStats(): void {
    this.cache.resetStats();
  }
}
