import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkspaceInfo } from './types.js';

interface PackageManifest {
  main?: unknown;
  module?: unknown;
  browser?: unknown;
  types?: unknown;
  typings?: unknown;
  bin?: unknown;
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRAMEWORK_ENTRY_PATTERNS: Array<{
  packages: string[];
  patterns: string[];
}> = [
  {
    packages: ['next'],
    patterns: [
      '**/pages/**/*.*',
      '**/app/**/page.*',
      '**/app/**/layout.*',
      '**/app/**/route.*',
      '**/app/**/loading.*',
      '**/app/**/error.*',
      '**/app/**/not-found.*',
      '**/middleware.*',
    ],
  },
  {
    packages: ['@remix-run/dev', '@remix-run/react'],
    patterns: ['**/app/routes/**/*.*', '**/app/root.*', '**/entry.client.*', '**/entry.server.*'],
  },
  {
    packages: ['@sveltejs/kit'],
    patterns: ['**/src/routes/**/+page.*', '**/src/routes/**/+layout.*', '**/src/routes/**/+server.*', '**/src/routes/**/+error.*'],
  },
  {
    packages: ['astro'],
    patterns: ['**/src/pages/**/*.*'],
  },
  {
    packages: ['gatsby'],
    patterns: ['**/src/pages/**/*.*', '**/gatsby-node.*', '**/gatsby-config.*', '**/gatsby-browser.*', '**/gatsby-ssr.*'],
  },
  {
    packages: ['nuxt'],
    patterns: ['**/pages/**/*.*', '**/server/api/**/*.*', '**/middleware/**/*.*', '**/app.vue'],
  },
  {
    packages: ['@storybook/react', '@storybook/vue3', '@storybook/svelte'],
    patterns: ['**/*.stories.*', '**/.storybook/**/*.*'],
  },
];

async function readManifest(packageDir: string): Promise<PackageManifest | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf-8')) as PackageManifest;
  } catch {
    return null;
  }
}

function collectStringTargets(value: unknown, targets: string[]): void {
  if (typeof value === 'string') {
    targets.push(value);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    collectStringTargets(nestedValue, targets);
  }
}

function normalizeDeclaredTarget(
  rootDir: string,
  packageDir: string,
  target: string,
): string | null {
  if (!target.startsWith('.') || target.includes('://')) return null;
  const absoluteTarget = path.resolve(packageDir, target);
  const relativeTarget = path.relative(rootDir, absoluteTarget).replaceAll('\\', '/');
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) return null;
  return relativeTarget;
}

/** Detect package exports, executable entries, and framework-owned routes. */
export async function detectProjectEntryPointPatterns(
  rootDir: string,
  workspaces: WorkspaceInfo[] = [],
): Promise<string[]> {
  const packageDirectories = [rootDir, ...workspaces.map((workspace) => workspace.absolutePath)];
  const patterns = new Set<string>();

  for (const packageDir of packageDirectories) {
    const manifest = await readManifest(packageDir);
    if (!manifest) continue;

    const declaredTargets: string[] = [];
    for (const value of [
      manifest.main,
      manifest.module,
      manifest.browser,
      manifest.types,
      manifest.typings,
      manifest.bin,
      manifest.exports,
    ]) {
      collectStringTargets(value, declaredTargets);
    }
    for (const target of declaredTargets) {
      const normalizedTarget = normalizeDeclaredTarget(rootDir, packageDir, target);
      if (normalizedTarget) patterns.add(normalizedTarget);
    }

    const installedPackages = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);
    for (const framework of FRAMEWORK_ENTRY_PATTERNS) {
      if (framework.packages.some((packageName) => installedPackages.has(packageName))) {
        framework.patterns.forEach((pattern) => patterns.add(pattern));
      }
    }
  }

  return [...patterns].sort((a, b) => a.localeCompare(b));
}
