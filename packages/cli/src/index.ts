#!/usr/bin/env node
// ============================================================================
// React Dependency Graph — CLI Entry Point
// ============================================================================
// Usage:
//   npx react-dependency-graph scan                    # Scan current directory
//   npx react-dependency-graph scan ./my-app            # Scan specific directory
//   npx react-dependency-graph scan --format json       # JSON output (default)
//   npx react-dependency-graph scan --format text       # Human-readable summary
//   npx react-dependency-graph scan --output graph.json # Write to file
//   npx react-dependency-graph scan --ignore __tests__ e2e  # Extra ignore patterns
//
// Short alias:
//   npx rdg scan
// ============================================================================

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { scanProject, exportGraphJSON } from '@rdg/core';
import type { ScanResult } from '@rdg/core';

const program = new Command();

program
  .name('react-dependency-graph')
  .description(
    'Scan React projects and generate dependency graphs.\n' +
      'Useful for understanding project structure, detecting circular dependencies,\n' +
      'and providing structured data to AI coding agents.',
  )
  .version('0.1.0');

// ─── scan command ──────────────────────────────────────────────────────────
program
  .command('scan')
  .description('Scan a React project and output its dependency graph')
  .argument('[dir]', 'Project directory to scan (default: current directory)', '.')
  .option(
    '-f, --format <format>',
    'Output format: json | text',
    'json',
  )
  .option(
    '-o, --output <file>',
    'Write output to a file instead of stdout',
  )
  .option(
    '--ignore <patterns...>',
    'Additional directory/file patterns to ignore',
  )
  .option(
    '--no-circular',
    'Skip circular dependency detection',
  )
  .option(
    '--no-aliases',
    'Skip tsconfig/jsconfig path alias resolution',
  )
  .option(
    '--extensions <exts...>',
    'File extensions to scan (default: .js .jsx .ts .tsx)',
  )
  .option(
    '--max-depth <depth>',
    'Maximum directory traversal depth',
  )
  .action(async (dir: string, opts) => {
    try {
      const rootDir = path.resolve(dir);

      // Verify the directory exists
      try {
        await fs.access(rootDir);
      } catch {
        console.error(`❌ Directory not found: ${rootDir}`);
        process.exit(1);
      }

      // Show scanning indicator
      if (opts.format === 'text') {
        console.error(`🔍 Scanning ${rootDir}...`);
      }

      // Run the scan
      const result = await scanProject({
        rootDir,
        extensions: opts.extensions,
        ignorePatterns: opts.ignore,
        detectCircular: opts.circular !== false,
        resolveAliases: opts.aliases !== false,
        maxDepth: opts.maxDepth ? parseInt(opts.maxDepth, 10) : undefined,
      });

      // Format the output
      let output: string;
      if (opts.format === 'text') {
        output = formatAsText(result);
      } else {
        output = exportGraphJSON(result.graph);
      }

      // Write to file or stdout
      if (opts.output) {
        const outputPath = path.resolve(opts.output);
        await fs.writeFile(outputPath, output, 'utf-8');
        console.error(`✅ Output written to ${outputPath}`);
      } else {
        console.log(output);
      }

      // Exit with code 1 if circular dependencies were found (useful for CI)
      if (result.circularCount > 0 && opts.format === 'text') {
        console.error(
          `\n⚠️  Found ${result.circularCount} circular dependency chain(s)`,
        );
      }
    } catch (err) {
      console.error(`❌ Scan failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ─── Text formatter ────────────────────────────────────────────────────────

/**
 * Format a ScanResult as a human-readable text summary.
 */
function formatAsText(result: ScanResult): string {
  const { graph, totalFiles, totalImports, circularCount, durationMs, errors } =
    result;
  const lines: string[] = [];

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════╗');
  lines.push('║        React Dependency Graph — Scan Results        ║');
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
      lines.push(`     ${node.inDegree.toString().padStart(3)}x  ${node.relativePath}`);
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
      lines.push(`     ${node.outDegree.toString().padStart(3)}→  ${node.relativePath}`);
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

// ─── Run ───────────────────────────────────────────────────────────────────
program.parse();
