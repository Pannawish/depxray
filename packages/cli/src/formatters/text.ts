// ============================================================================
// Text Formatter — Human-readable summary of a scan result
// ============================================================================
// Produces a nicely formatted, emoji-decorated report showing:
//   - Project summary (files, imports, duration)
//   - Top imported files (highest in-degree)
//   - Files with most imports (highest out-degree)
//   - Circular dependency warnings
//   - Orphan files (disconnected from the graph)
//   - Parse errors
// ============================================================================

import type { ScanResult } from '@depxray/core';

/**
 * Format a ScanResult as a human-readable text report.
 */
export function formatAsText(result: ScanResult): string {
  const { graph, totalFiles, totalImports, circularCount, durationMs, errors } =
    result;
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════╗');
  lines.push('║              Depxray — Scan Results                ║');
  lines.push('╚══════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`  📁 Project:     ${graph.rootDir}`);
  lines.push(`  📄 Files:       ${totalFiles}`);
  lines.push(`  🔗 Imports:     ${totalImports}`);
  lines.push(`  🔄 Circular:    ${circularCount}`);
  lines.push(`  ⏱️  Duration:    ${durationMs.toFixed(0)}ms`);

  if (errors.length > 0) {
    lines.push(`  ⚠️  Parse errors: ${errors.length}`);
  }

  // ── Top imported files (highest inDegree) ──────────────────────────
  const topImported = [...graph.nodes]
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 10)
    .filter((n) => n.inDegree > 0);

  if (topImported.length > 0) {
    lines.push('');
    lines.push('  📊 Most Imported Files:');
    for (const node of topImported) {
      const marker = node.isCircular ? ' 🔴' : '';
      lines.push(
        `     ${node.inDegree.toString().padStart(3)}x  ${node.relativePath}${marker}`,
      );
    }
  }

  // ── Top importing files (highest outDegree) ────────────────────────
  const topImporting = [...graph.nodes]
    .sort((a, b) => b.outDegree - a.outDegree)
    .slice(0, 10)
    .filter((n) => n.outDegree > 0);

  if (topImporting.length > 0) {
    lines.push('');
    lines.push('  📊 Files with Most Imports:');
    for (const node of topImporting) {
      const marker = node.isCircular ? ' 🔴' : '';
      lines.push(
        `     ${node.outDegree.toString().padStart(3)}→  ${node.relativePath}${marker}`,
      );
    }
  }

  // ── Circular dependencies ──────────────────────────────────────────
  if (graph.circularDependencies.length > 0) {
    lines.push('');
    lines.push('  🔴 Circular Dependencies:');
    for (const cycle of graph.circularDependencies) {
      lines.push(`     ↻ ${cycle.description}`);
    }
  }

  // ── Orphan files (no imports and not imported) ─────────────────────
  const orphans = graph.nodes.filter(
    (n) => n.inDegree === 0 && n.outDegree === 0,
  );
  if (orphans.length > 0) {
    lines.push('');
    lines.push(`  🏝️  Orphan Files (${orphans.length}):`);
    for (const orphan of orphans.slice(0, 5)) {
      lines.push(`     - ${orphan.relativePath}`);
    }
    if (orphans.length > 5) {
      lines.push(`     ... and ${orphans.length - 5} more`);
    }
  }

  // ── Parse errors ───────────────────────────────────────────────────
  if (errors.length > 0) {
    lines.push('');
    lines.push('  ⚠️  Parse Errors:');
    for (const err of errors.slice(0, 5)) {
      lines.push(`     - ${err.filePath}: ${err.error}`);
    }
    if (errors.length > 5) {
      lines.push(`     ... and ${errors.length - 5} more`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
