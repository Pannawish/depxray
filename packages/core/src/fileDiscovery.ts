// ============================================================================
// fileDiscovery — Walk the filesystem and find scannable files
// ============================================================================
// Recursively traverses a project directory, collects files matching the
// target extensions, and prunes directories that should be ignored
// (node_modules, dist, .git, etc.).
//
// Uses async I/O to avoid blocking Node.js on large projects.
// ============================================================================

import * as path from 'path';
import * as fs from 'fs/promises';
import { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_PATTERNS } from './types.js';

/**
 * Check if a directory name should be ignored during traversal.
 */
function shouldIgnoreDir(dirName: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some((pattern) => {
    // Simple name matching (no glob support yet — keep it straightforward)
    return dirName === pattern || dirName.startsWith(pattern);
  });
}

/**
 * Check if a file matches the target extensions.
 */
function hasTargetExtension(filePath: string, extensions: string[]): boolean {
  return extensions.some((ext) => filePath.endsWith(ext));
}

/**
 * Recursively discover all scannable files in a directory.
 *
 * @param rootDir        - The project root directory
 * @param extensions     - File extensions to include
 * @param ignorePatterns - Directory names to skip entirely
 * @param maxDepth       - Maximum recursion depth (default: Infinity)
 * @returns Array of absolute file paths
 *
 * @example
 * ```typescript
 * const files = await discoverFiles('/path/to/project');
 * // [
 * //   '/path/to/project/src/App.tsx',
 * //   '/path/to/project/src/components/Button.tsx',
 * //   ...
 * // ]
 * ```
 */
export async function discoverFiles(
  rootDir: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
  ignorePatterns: string[] = DEFAULT_IGNORE_PATTERNS,
  maxDepth: number = Infinity,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string, currentDepth: number): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      // Permission denied or other access error — skip silently
      return;
    }

    // Process entries in parallel for performance
    const tasks: Promise<void>[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip ignored directories entirely (prune the subtree)
        if (!shouldIgnoreDir(entry.name, ignorePatterns)) {
          tasks.push(walk(fullPath, currentDepth + 1));
        }
      } else if (entry.isFile()) {
        if (hasTargetExtension(entry.name, extensions)) {
          results.push(fullPath);
        }
      }
    }

    await Promise.all(tasks);
  }

  await walk(rootDir, 0);

  // Sort for deterministic output (helps with testing and diffing)
  return results.sort();
}
