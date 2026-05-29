// ============================================================================
// inspect command — Inspect a single file's dependencies
// ============================================================================
// Shows what a specific file imports and what imports it.
// Useful for AI agents that need to understand a single file's context.
//
// Usage:
//   rdg inspect src/App.tsx
//   rdg inspect src/App.tsx --format json
// ============================================================================

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { scanProject } from '@rdg/core';

export function createInspectCommand(): Command {
  const cmd = new Command('inspect')
    .description(
      "Inspect a single file's dependencies — shows what it imports and what imports it",
    )
    .argument('<file>', 'File to inspect (relative or absolute path)')
    .option(
      '-d, --dir <dir>',
      'Project root directory (default: current directory)',
      '.',
    )
    .option('-f, --format <format>', 'Output format: text | json', 'text')
    .action(async (file: string, opts) => {
      try {
        const rootDir = path.resolve(opts.dir);
        const filePath = path.resolve(rootDir, file);

        // Verify the file exists
        try {
          await fs.access(filePath);
        } catch {
          console.error(`❌ File not found: ${filePath}`);
          process.exit(1);
        }

        // Run a full scan (we need the graph to know reverse deps)
        process.stderr.write(`🔍 Scanning ${rootDir}...\n`);
        const result = await scanProject({ rootDir, detectCircular: true });
        const { graph } = result;

        // Find this file's node
        const node = graph.nodes.find((n) => n.id === filePath);
        if (!node) {
          console.error(
            `❌ File not found in dependency graph: ${file}\n` +
              `   Make sure it has a supported extension (.ts, .tsx, .js, .jsx)`,
          );
          process.exit(1);
        }

        // Find outgoing edges (what this file imports)
        const imports = graph.edges.filter((e) => e.source === filePath);

        // Find incoming edges (what imports this file)
        const importedBy = graph.edges.filter((e) => e.target === filePath);

        if (opts.format === 'json') {
          const output = {
            file: node.relativePath,
            extension: node.extension,
            inDegree: node.inDegree,
            outDegree: node.outDegree,
            isCircular: node.isCircular,
            imports: imports.map((e) => ({
              file: path.relative(rootDir, e.target),
              specifier: e.importSpecifier,
              names: e.importedNames,
              isTypeOnly: e.isTypeOnly,
              isDynamic: e.isDynamic,
            })),
            importedBy: importedBy.map((e) => ({
              file: path.relative(rootDir, e.source),
              specifier: e.importSpecifier,
              names: e.importedNames,
              isTypeOnly: e.isTypeOnly,
            })),
          };
          process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        } else {
          // Text format
          const lines: string[] = [];

          lines.push('');
          lines.push(
            `  📄 ${node.relativePath}${node.isCircular ? ' 🔴 CIRCULAR' : ''}`,
          );
          lines.push(`     Extension: ${node.extension}`);
          lines.push(`     Imports:   ${node.outDegree} files`);
          lines.push(`     Used by:   ${node.inDegree} files`);

          if (imports.length > 0) {
            lines.push('');
            lines.push('  📥 This file imports:');
            for (const edge of imports) {
              const rel = path.relative(rootDir, edge.target);
              const names = edge.importedNames.length > 0
                ? ` { ${edge.importedNames.join(', ')} }`
                : '';
              const flags: string[] = [];
              if (edge.isTypeOnly) flags.push('type-only');
              if (edge.isDynamic) flags.push('dynamic');
              const flagStr =
                flags.length > 0 ? ` (${flags.join(', ')})` : '';
              lines.push(`     → ${rel}${names}${flagStr}`);
            }
          }

          if (importedBy.length > 0) {
            lines.push('');
            lines.push('  📤 Imported by:');
            for (const edge of importedBy) {
              const rel = path.relative(rootDir, edge.source);
              const names = edge.importedNames.length > 0
                ? ` { ${edge.importedNames.join(', ')} }`
                : '';
              lines.push(`     ← ${rel}${names}`);
            }
          }

          if (imports.length === 0 && importedBy.length === 0) {
            lines.push('');
            lines.push('  🏝️  This file is an orphan (no imports, not imported)');
          }

          lines.push('');
          process.stdout.write(lines.join('\n') + '\n');
        }
      } catch (err) {
        console.error(`❌ Inspect failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
