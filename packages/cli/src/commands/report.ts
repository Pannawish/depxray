// ============================================================================
// report command - Generate a Markdown project health report
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import {
  loadConfig,
  scanProject,
  type DepxrayConfig,
  type GraphNode,
  type ScanResult,
} from '@depxray/core';

interface ReportCommandOptions {
  output?: string;
  ignore?: string[];
  circular?: boolean;
  aliases?: boolean;
  extensions?: string[];
  entryPoints?: string[];
}

type OptionSourceReader = (name: string) => string | undefined;

function cliOptionWasProvided(getOptionSource: OptionSourceReader, name: string): boolean {
  return getOptionSource(name) === 'cli';
}

function mergeReportOptionsWithConfig(
  rawOptions: ReportCommandOptions,
  config: DepxrayConfig,
  getOptionSource: OptionSourceReader,
): ReportCommandOptions {
  return {
    ...rawOptions,
    ignore: cliOptionWasProvided(getOptionSource, 'ignore')
      ? rawOptions.ignore
      : config.ignore ?? rawOptions.ignore,
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : config.circular ?? rawOptions.circular,
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : config.aliases ?? rawOptions.aliases,
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : config.extensions ?? rawOptions.extensions,
    entryPoints: cliOptionWasProvided(getOptionSource, 'entryPoints')
      ? rawOptions.entryPoints
      : config.entryPoints ?? rawOptions.entryPoints,
  };
}

async function verifyDirectory(rootDir: string): Promise<void> {
  try {
    const stat = await fs.stat(rootDir);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${rootDir}`);
    }
  } catch {
    throw new Error(`Directory not found: ${rootDir}`);
  }
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100)}%`;
}

function topByDegree(
  nodes: GraphNode[],
  key: 'inDegree' | 'outDegree',
  limit = 10,
): GraphNode[] {
  return [...nodes]
    .filter((node) => node[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.relativePath.localeCompare(b.relativePath))
    .slice(0, limit);
}

function topByComplexity(nodes: GraphNode[], limit = 10): GraphNode[] {
  return [...nodes]
    .filter((node) => (node.metrics?.cyclomaticComplexity ?? 0) > 1)
    .sort((a, b) => (
      (b.metrics?.cyclomaticComplexity ?? 0) - (a.metrics?.cyclomaticComplexity ?? 0)
      || (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0)
      || a.relativePath.localeCompare(b.relativePath)
    ))
    .slice(0, limit);
}

function addNodeDegreeTable(
  lines: string[],
  nodes: GraphNode[],
  key: 'inDegree' | 'outDegree',
): void {
  if (nodes.length === 0) {
    lines.push('_None_');
    lines.push('');
    return;
  }

  if (key === 'inDegree') {
    lines.push('| Rank | File | Imported By | Imports |');
  } else {
    lines.push('| Rank | File | Imports | Imported By |');
  }
  lines.push('| ---: | --- | ---: | ---: |');
  nodes.forEach((node, index) => {
    lines.push(
      key === 'inDegree'
        ? `| ${index + 1} | \`${escapeMarkdownTableCell(node.relativePath)}\` | ${node.inDegree} | ${node.outDegree} |`
        : `| ${index + 1} | \`${escapeMarkdownTableCell(node.relativePath)}\` | ${node.outDegree} | ${node.inDegree} |`,
    );
  });
  lines.push('');
}

function addComplexityTable(lines: string[], nodes: GraphNode[]): void {
  if (nodes.length === 0) {
    lines.push('_None_');
    lines.push('');
    return;
  }

  lines.push('| Rank | File | Complexity | LOC | Exports | Instability |');
  lines.push('| ---: | --- | ---: | ---: | ---: | ---: |');
  nodes.forEach((node, index) => {
    const metrics = node.metrics;
    lines.push(
      `| ${index + 1} | \`${escapeMarkdownTableCell(node.relativePath)}\` | ${metrics?.cyclomaticComplexity ?? 0} | ${metrics?.loc ?? 0} | ${metrics?.exportCount ?? 0} | ${formatPercent(metrics?.instability ?? 0)} |`,
    );
  });
  lines.push('');
}

function addBulletList(lines: string[], items: string[]): void {
  if (items.length === 0) {
    lines.push('_None_');
    lines.push('');
    return;
  }

  for (const item of items) {
    lines.push(`- \`${item}\``);
  }
  lines.push('');
}

export function generateMarkdownReport(result: ScanResult): string {
  const nodes = result.graph.nodes;
  const mostImported = topByDegree(nodes, 'inDegree');
  const mostImporting = topByDegree(nodes, 'outDegree');
  const complexityHotspots = topByComplexity(nodes);
  const totalLoc = nodes.reduce((sum, node) => sum + (node.metrics?.loc ?? 0), 0);
  const generatedAt = result.graph.metadata.scannedAt;
  const circularChains = result.graph.circularDependencies
    .slice(0, 10)
    .map((chain) => chain.description);

  const lines: string[] = [];
  lines.push('# depxray Project Health Report');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Project: \`${result.graph.rootDir}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  lines.push(`| Files | ${result.totalFiles} |`);
  lines.push(`| Imports | ${result.totalImports} |`);
  lines.push(`| Circular chains | ${result.circularCount} |`);
  lines.push(`| Orphan files | ${result.orphanFiles.length} |`);
  lines.push(`| Total LOC | ${totalLoc} |`);
  lines.push(`| Scan duration | ${formatNumber(result.durationMs)} ms |`);
  lines.push('');
  lines.push('## Top 10 Most Imported Files');
  lines.push('');
  addNodeDegreeTable(lines, mostImported, 'inDegree');
  lines.push('## Top 10 Most Importing Files');
  lines.push('');
  addNodeDegreeTable(lines, mostImporting, 'outDegree');
  lines.push('## Complexity Hotspots');
  lines.push('');
  addComplexityTable(lines, complexityHotspots);
  lines.push('## Orphan Files');
  lines.push('');
  addBulletList(lines, result.orphanFiles);
  lines.push('## Circular Dependency Chains');
  lines.push('');
  addBulletList(lines, circularChains);

  return lines.join('\n').trimEnd() + '\n';
}

export function createReportCommand(): Command {
  const cmd = new Command('report')
    .description('Generate a Markdown project health report')
    .argument('[dir]', 'Directory to scan', '.')
    .option('-o, --output <file>', 'Write the Markdown report to a file')
    .option('--ignore <patterns...>', 'Additional glob-like path patterns to ignore')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig.json/jsconfig.json path alias resolution')
    .option('--extensions <exts...>', 'File extensions to scan, e.g. .ts .tsx .js .jsx')
    .option('--entry-points <patterns...>', 'Glob patterns to exclude from orphan detection')
    .action(async (dir: string, rawOptions: ReportCommandOptions, command: Command) => {
      try {
        const rootDir = path.resolve(dir);
        await verifyDirectory(rootDir);

        const config = await loadConfig(rootDir);
        const options = mergeReportOptionsWithConfig(
          rawOptions,
          config,
          (name) => command.getOptionValueSource(name),
        );

        process.stderr.write(`Generating report for ${rootDir}...\n`);
        const result = await scanProject({
          rootDir,
          ignorePatterns: options.ignore,
          detectCircular: options.circular,
          resolveAliases: options.aliases,
          extensions: options.extensions,
          entryPointPatterns: options.entryPoints,
        });
        const report = generateMarkdownReport(result);

        if (options.output) {
          const outputPath = path.resolve(options.output);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, report, 'utf-8');
          process.stderr.write(`Report written to ${outputPath}\n`);
          return;
        }

        process.stdout.write(report);
      } catch (err) {
        console.error(`Report failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
