import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileTreeNode, ScanFileTreeOptions } from './types.js';
import { DEFAULT_IGNORE_PATTERNS } from './types.js';

function shouldIgnoreEntry(name: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some((pattern) => name === pattern || name.startsWith(pattern));
}

function compareEntries(
  left: { name: string; isDirectory(): boolean },
  right: { name: string; isDirectory(): boolean },
): number {
  if (left.isDirectory() !== right.isDirectory()) {
    return left.isDirectory() ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

export async function scanFileTree(
  rootDir: string,
  options: ScanFileTreeOptions = {},
): Promise<FileTreeNode> {
  const resolvedRoot = path.resolve(rootDir);
  const { ignorePatterns: userIgnorePatterns = [], maxDepth = Infinity } = options;
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...userIgnorePatterns];

  let rootStat;
  try {
    rootStat = await fs.stat(resolvedRoot);
  } catch (err) {
    throw new Error(`Cannot access project root: ${resolvedRoot} — ${(err as Error).message}`);
  }

  if (!rootStat.isDirectory()) {
    throw new Error(`Not a directory: ${resolvedRoot}`);
  }

  async function walkDirectory(absolutePath: string, depth: number): Promise<FileTreeNode[]> {
    if (depth > maxDepth) {
      return [];
    }

    let entries;
    try {
      entries = await fs.readdir(absolutePath, { withFileTypes: true });
    } catch {
      return [];
    }

    const visibleEntries = entries
      .filter((entry) => !shouldIgnoreEntry(entry.name, ignorePatterns))
      .sort(compareEntries);

    const children = await Promise.all(
      visibleEntries.map(async (entry) => {
        const entryPath = path.join(absolutePath, entry.name);
        const relativePath = path.relative(resolvedRoot, entryPath);
        const baseNode = {
          id: entryPath,
          name: entry.name,
          relativePath,
          absolutePath: entryPath,
          kind: entry.isDirectory() ? ('directory' as const) : ('file' as const),
          extension: entry.isDirectory() ? null : path.extname(entry.name) || null,
          depth,
        };

        if (entry.isDirectory()) {
          return {
            ...baseNode,
            children: depth >= maxDepth ? [] : await walkDirectory(entryPath, depth + 1),
          };
        }

        const stat = await fs.stat(entryPath);
        return {
          ...baseNode,
          children: [],
          sizeBytes: stat.size,
        };
      }),
    );

    return children;
  }

  return {
    id: resolvedRoot,
    name: path.basename(resolvedRoot),
    relativePath: '.',
    absolutePath: resolvedRoot,
    kind: 'directory',
    extension: null,
    depth: 0,
    children: await walkDirectory(resolvedRoot, 1),
  };
}
