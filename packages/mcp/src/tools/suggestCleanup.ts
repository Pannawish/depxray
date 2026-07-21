import { resolveRootDir, scanProject } from './shared.js';

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
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  evidence: string[];
  caveats: string[];
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
      impact: 'review',
      confidence: 'medium',
      reason: 'No static incoming imports and no recognized entry-point convention.',
      evidence: [
        'The dependency graph reports zero inbound edges.',
        'The file did not match declared package or detected framework entry points.',
      ],
      caveats: [
        'Runtime loading, framework conventions, generated registries, and external consumers may not appear as static imports.',
      ],
    });
  }

  for (const node of result.graph.nodes) {
    for (const unusedExport of node.unusedExports ?? []) {
      suggestions.push({
        action: 'remove_unused_export',
        file: node.relativePath,
        detail: unusedExport.name,
        impact: 'review',
        confidence: unusedExport.kind === 'named' && !unusedExport.isTypeOnly ? 'medium' : 'low',
        reason: `Export "${unusedExport.name}" has no static consumers in the scanned project.`,
        evidence: [
          `No import or re-export references "${unusedExport.name}".`,
          `Declaration found at line ${unusedExport.line}.`,
        ],
        caveats: [
          'Public package APIs, dynamic property access, generated code, and consumers outside this repository are not observable.',
        ],
      });
    }
  }

  for (const unresolved of result.unresolvedImports) {
    suggestions.push({
      action: 'resolve_broken_import',
      file: unresolved.file,
      detail: unresolved.importSpecifier,
      impact: 'review',
      confidence: 'high',
      reason: `Import "${unresolved.importSpecifier}" does not resolve to any file.`,
      evidence: [`Static resolution failed at line ${unresolved.line}.`],
      caveats: ['A runtime loader, bundler plugin, or non-code asset resolver may handle this specifier.'],
    });
  }

  for (const unusedDependency of result.dependencyIssues?.unused ?? []) {
    suggestions.push({
      action: 'remove_unused_dependency',
      file: 'package.json',
      detail: unusedDependency,
      impact: 'review',
      confidence: 'low',
      reason: `Package "${unusedDependency}" has no static imports in scanned source files.`,
      evidence: ['No parsed import or require references this package.'],
      caveats: ['CLI tools, config files, plugins, scripts, and runtime string-based loading may still use this package.'],
    });
  }

  for (const chain of result.graph.circularDependencies) {
    suggestions.push({
      action: 'fix_circular_dependency',
      file: chain.chain[0],
      detail: chain.description,
      impact: 'risky',
      confidence: 'high',
      reason: `Circular chain: ${chain.description}`,
      evidence: [`A closed static import path was detected: ${chain.description}`],
      caveats: ['Breaking the cycle can change initialization order and module boundaries.'],
    });
  }

  const impactOrder: Record<CleanupSuggestion['impact'], number> = {
    safe: 0,
    review: 1,
    risky: 2,
  };
  const confidenceOrder: Record<CleanupSuggestion['confidence'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  suggestions.sort((a, b) => (
    impactOrder[a.impact] - impactOrder[b.impact] ||
    confidenceOrder[a.confidence] - confidenceOrder[b.confidence] ||
    a.file.localeCompare(b.file) ||
    a.detail.localeCompare(b.detail)
  ));

  return {
    count: Math.min(suggestions.length, maxSuggestions),
    totalIssues: suggestions.length,
    confidenceSummary: {
      high: suggestions.filter((suggestion) => suggestion.confidence === 'high').length,
      medium: suggestions.filter((suggestion) => suggestion.confidence === 'medium').length,
      low: suggestions.filter((suggestion) => suggestion.confidence === 'low').length,
    },
    suggestions: suggestions.slice(0, maxSuggestions),
  };
}
