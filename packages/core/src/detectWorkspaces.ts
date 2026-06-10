import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AliasMapping, WorkspaceInfo } from './types.js';
import { DEFAULT_IGNORE_PATTERNS } from './types.js';
import { matchesAnyPattern } from './detectOrphanFiles.js';

type PackageJsonWithWorkspaces = {
  name?: string;
  workspaces?: string[] | {
    packages?: string[];
  };
};

function readWorkspacePatterns(packageJson: PackageJsonWithWorkspaces): string[] {
  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces;
  }

  if (packageJson.workspaces && Array.isArray(packageJson.workspaces.packages)) {
    return packageJson.workspaces.packages;
  }

  return [];
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/').replace(/\/$/, '');
}

function shouldIgnoreDirectory(name: string): boolean {
  return DEFAULT_IGNORE_PATTERNS.includes(name) || name === '.git';
}

async function readPackageJson(filePath: string): Promise<PackageJsonWithWorkspaces | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as PackageJsonWithWorkspaces;
  } catch {
    return null;
  }
}

async function findPackageJsonFiles(rootDir: string): Promise<string[]> {
  const packageJsonFiles: string[] = [];

  async function visit(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || shouldIgnoreDirectory(entry.name)) {
        continue;
      }

      const childDir = path.join(dirPath, entry.name);
      const packageJsonPath = path.join(childDir, 'package.json');
      try {
        const stat = await fs.stat(packageJsonPath);
        if (stat.isFile()) {
          packageJsonFiles.push(packageJsonPath);
        }
      } catch {
        // Directory is still worth traversing; a nested workspace can exist below it.
      }

      await visit(childDir);
    }
  }

  await visit(rootDir);
  return packageJsonFiles;
}

function matchesWorkspacePattern(relativeDir: string, patterns: string[]): boolean {
  const normalizedDir = normalizeRelativePath(relativeDir);
  return patterns.some((pattern) => {
    const normalizedPattern = normalizeRelativePath(pattern);
    return normalizedDir === normalizedPattern || matchesAnyPattern(normalizedDir, [normalizedPattern]);
  });
}

export async function detectWorkspaces(rootDir: string): Promise<WorkspaceInfo[]> {
  const resolvedRoot = path.resolve(rootDir);
  const rootPackageJson = await readPackageJson(path.join(resolvedRoot, 'package.json'));
  if (!rootPackageJson) {
    return [];
  }

  const workspacePatterns = readWorkspacePatterns(rootPackageJson);
  if (workspacePatterns.length === 0) {
    return [];
  }

  const packageJsonFiles = await findPackageJsonFiles(resolvedRoot);
  const workspaces: WorkspaceInfo[] = [];

  for (const packageJsonPath of packageJsonFiles) {
    const workspaceDir = path.dirname(packageJsonPath);
    const relativePath = normalizeRelativePath(path.relative(resolvedRoot, workspaceDir));
    if (!relativePath || !matchesWorkspacePattern(relativePath, workspacePatterns)) {
      continue;
    }

    const packageJson = await readPackageJson(packageJsonPath);
    workspaces.push({
      name: packageJson?.name || relativePath,
      relativePath,
      absolutePath: workspaceDir,
    });
  }

  return workspaces.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function getWorkspaceForPath(
  filePath: string,
  workspaces: WorkspaceInfo[],
): WorkspaceInfo | undefined {
  const resolvedFilePath = path.resolve(filePath);

  return [...workspaces]
    .sort((a, b) => b.absolutePath.length - a.absolutePath.length)
    .find((workspace) => {
      const relative = path.relative(workspace.absolutePath, resolvedFilePath);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
}

export function createWorkspaceAliases(workspaces: WorkspaceInfo[]): AliasMapping[] {
  return workspaces.flatMap((workspace) => {
    const sourceDir = path.join(workspace.absolutePath, 'src');
    return [
      {
        prefix: workspace.name,
        paths: [workspace.absolutePath, sourceDir],
      },
      {
        prefix: `${workspace.name}/`,
        paths: [workspace.absolutePath, sourceDir],
      },
    ];
  });
}
