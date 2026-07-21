// ============================================================================
// detectOrphanFiles - Find dependency graph nodes with no incoming imports
// ============================================================================

import type { DependencyGraph, OrphanDetectionOptions } from './types.js';
import { DEFAULT_ENTRY_POINT_PATTERNS } from './types.js';

function escapeRegExpChar(char: string): string {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}

function globToRegExp(pattern: string): RegExp {
  const normalizedPattern = pattern.replaceAll('\\', '/');
  let source = '^';
  let index = 0;

  while (index < normalizedPattern.length) {
    const char = normalizedPattern[index];
    const next = normalizedPattern[index + 1];
    const afterNext = normalizedPattern[index + 2];

    if (char === '*' && next === '*' && afterNext === '/') {
      source += '(?:.*/)?';
      index += 3;
      continue;
    }

    if (char === '*' && next === '*') {
      source += '.*';
      index += 2;
      continue;
    }

    if (char === '*') {
      source += '[^/]*';
      index += 1;
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      index += 1;
      continue;
    }

    source += escapeRegExpChar(char);
    index += 1;
  }

  source += '$';
  return new RegExp(source);
}

export function matchesAnyPattern(relativePath: string, patterns: string[]): boolean {
  const normalizedPath = relativePath.replaceAll('\\', '/');
  return patterns.some((pattern) => globToRegExp(pattern).test(normalizedPath));
}

export function detectOrphanFiles(
  graph: DependencyGraph,
  options: OrphanDetectionOptions = {},
): string[] {
  const entryPointPatterns = options.entryPointPatterns ?? DEFAULT_ENTRY_POINT_PATTERNS;

  return graph.nodes
    .filter((node) => node.inDegree === 0)
    .filter((node) => !matchesAnyPattern(node.relativePath, entryPointPatterns))
    .map((node) => node.relativePath)
    .sort((a, b) => a.localeCompare(b));
}
