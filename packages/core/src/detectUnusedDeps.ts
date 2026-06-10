import { builtinModules } from 'node:module';
import type { GraphEdge, UnusedDepsResult } from './types.js';

type PackageJsonDeps = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const BUILTIN_MODULES = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => name.replace(/^node:/, '')),
]);

function getDeclaredPackages(packageJson: PackageJsonDeps): Set<string> {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
}

export function normalizePackageName(specifier: string): string | null {
  if (
    !specifier ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#')
  ) {
    return null;
  }

  const withoutNodePrefix = specifier.startsWith('node:')
    ? specifier.slice('node:'.length)
    : specifier;

  if (BUILTIN_MODULES.has(withoutNodePrefix)) {
    return null;
  }

  if (withoutNodePrefix.startsWith('@')) {
    const [scope, name] = withoutNodePrefix.split('/');
    if (!scope || !name) {
      return null;
    }
    return `${scope}/${name}`;
  }

  return withoutNodePrefix.split('/')[0] || null;
}

export function detectUnusedDeps(
  _rootDir: string,
  imports: Array<Pick<GraphEdge, 'importSpecifier'>>,
  packageJson: PackageJsonDeps,
): UnusedDepsResult {
  const declaredPackages = getDeclaredPackages(packageJson);
  const usedPackages = new Set<string>();

  for (const item of imports) {
    const packageName = normalizePackageName(item.importSpecifier);
    if (!packageName || packageName === packageJson.name) {
      continue;
    }

    usedPackages.add(packageName);
  }

  const unused = [...declaredPackages]
    .filter((packageName) => !usedPackages.has(packageName))
    .sort((a, b) => a.localeCompare(b));
  const unlisted = [...usedPackages]
    .filter((packageName) => !declaredPackages.has(packageName))
    .sort((a, b) => a.localeCompare(b));

  return { unused, unlisted };
}
