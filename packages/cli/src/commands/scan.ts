// ============================================================================
// scan command — Scan an entire React project
// ============================================================================

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { scanProject } from '@rdg/core';
import { formatAsJSON } from '../formatters/json.js';
import { formatAsText } from '../formatters/text.js';
import { formatAsDot } from '../formatters/dot.js';

export function createScanCommand(): Command {
  const cmd = new Command('scan')
    .description('Scan a React project and output its dependency graph')
    .argument(
      '[dir]',
      'Project directory to scan (default: current directory)',
      '.',
    )
    .option('-f, --format <format>', 'Output format: json | text | dot', 'json')
    .option('-o, --output <file>', 'Write output to a file instead of stdout')
    .option('--ignore <patterns...>', 'Additional directory/file patterns to ignore')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .option(
      '--extensions <exts...>',
      'File extensions to scan (default: .js .jsx .ts .tsx)',
    )
    .option('--max-depth <depth>', 'Maximum directory traversal depth')
    .action(async (dir: string, opts) => {
      try {
        const rootDir = path.resolve(dir);

        // Verify the directory exists
        try {
          const stat = await fs.stat(rootDir);
          if (!stat.isDirectory()) {
            console.error(`❌ Not a directory: ${rootDir}`);
            process.exit(1);
          }
        } catch {
          console.error(`❌ Directory not found: ${rootDir}`);
          process.exit(1);
        }

        // Show scanning indicator on stderr (so stdout stays clean for piping)
        if (opts.format !== 'json') {
          process.stderr.write(`🔍 Scanning ${rootDir}...\n`);
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
        switch (opts.format) {
          case 'text':
            output = formatAsText(result);
            break;
          case 'dot':
            output = formatAsDot(result);
            break;
          case 'json':
          default:
            output = formatAsJSON(result);
            break;
        }

        // Write to file or stdout
        if (opts.output) {
          const outputPath = path.resolve(opts.output);
          await fs.writeFile(outputPath, output, 'utf-8');
          process.stderr.write(`✅ Output written to ${outputPath}\n`);
        } else {
          process.stdout.write(output + '\n');
        }

        // Warn about circular dependencies on stderr
        if (result.circularCount > 0) {
          process.stderr.write(
            `⚠️  Found ${result.circularCount} circular dependency chain(s)\n`,
          );
        }
      } catch (err) {
        console.error(`❌ Scan failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
