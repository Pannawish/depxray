import { scanProject } from '@depxray/core';
import { resolveRootDir } from './shared.js';

export interface SuggestCleanupInput {
  rootDir: string;
  maxSuggestions?: number;
}

export interface CleanupSuggestion {
  action:
    | 'remove_unused_export'
    | 'delete_orphan_file'
    | 'fix_circular_dependency'
    | 'resolve_broken_import'
    | 'remove_unused_dependency';
  file: string;
  detail: string;
  impact: 'safe' | 'review' | 'risky';
  reason: string;
}

export async function suggestCleanupTool(input: SuggestCleanupInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const maxSuggestions = input.maxSuggestions ?? 10;
  const result = await scanProject({
    rootDir,
    detectCircular: true,
    detectUnusedDeps: true,
  });
  const suggestions: CleanupSuggestion[] = [];

  for (const orphanFile of result.orphanFiles) {
    suggestions.push({
      action: 'delete_orphan_file',
      file: orphanFile,
      detail: orphanFile,
      impact: 'safe',
      reason: 'No incoming imports and not an entry point.',
    });
  }

  for (const node of result.graph.nodes) {
    for (const unusedExport of node.unusedExports ?? []) {
      suggestions.push({
        action: 'remove_unused_export',
        file: node.relativePath,
        detail: unusedExport.name,
        impact: 'safe',
        reason: `Export "${unusedExport.name}" is not imported by any file.`,
      });
    }
  }

  for (const unresolved of result.unresolvedImports) {
    suggestions.push({
      action: 'resolve_broken_import',
      file: unresolved.file,
      detail: unresolved.importSpecifier,
      impact: 'review',
      reason: `Import "${unresolved.importSpecifier}" does not resolve to any file.`,
    });
  }

  for (const unusedDependency of result.dependencyIssues?.unused ?? []) {
    suggestions.push({
      action: 'remove_unused_dependency',
      file: 'package.json',
      detail: unusedDependency,
      impact: 'safe',
      reason: `Package "${unusedDependency}" is in package.json but not imported by any scanned file.`,
    });
  }

  for (const chain of result.graph.circularDependencies) {
    suggestions.push({
      action: 'fix_circular_dependency',
      file: chain.chain[0],
      detail: chain.description,
      impact: 'risky',
      reason: `Circular chain: ${chain.description}`,
    });
  }

  const impactOrder: Record<CleanupSuggestion['impact'], number> = {
    safe: 0,
    review: 1,
    risky: 2,
  };
  suggestions.sort((a, b) => (
    impactOrder[a.impact] - impactOrder[b.impact] ||
    a.file.localeCompare(b.file) ||
    a.detail.localeCompare(b.detail)
  ));

  return {
    count: Math.min(suggestions.length, maxSuggestions),
    totalIssues: suggestions.length,
    suggestions: suggestions.slice(0, maxSuggestions),
  };
}
