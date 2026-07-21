import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { loadConfig, ProjectScanSession, type RuleValidationResult } from '@depxray/core';
import { formatAsDot } from '../formatters/dot.js';
import { formatAsMermaid } from '../formatters/mermaid.js';
import { formatAsSarif } from '../formatters/sarif.js';
import { loadPlugins } from '../plugins.js';
import {
  createStaticExport,
  normalizeInitialDepth,
  openBrowser,
  startGraphServer,
} from './scanBrowser.js';
import { applyFixes, confirmFixes, planFixes, printFixPlan, printFixSummary } from './scanFixes.js';
import {
  buildDependencyScanResult,
  buildGraphSet,
  buildSelectedGraphData,
  toDependencyGraphData,
} from './scanGraph.js';
import {
  mergeScanOptionsWithConfig,
  parseDepth,
  parseMode,
  parseOutputFormat,
  parsePort,
  validateScanCommandOptions,
  createDependencyScanOptions,
  type ScanCommandOptions,
  type ScanOutputFormat,
} from './scanOptions.js';
import {
  ensureDirectory,
  printOrphanFiles,
  printRuleViolations,
  printUnresolvedImports,
  printUnusedExports,
  serializeGraphData,
  verifyDirectory,
} from './scanOutput.js';
import { startWatchMode } from './scanWatch.js';

export { startGraphServer, listenOnAvailablePort } from './scanBrowser.js';
export { createWatchScheduler } from './scanWatch.js';
export { mergeScanOptionsWithConfig, parsePort } from './scanOptions.js';
export type { GraphServerHandle } from './scanBrowser.js';

function reportRequestedFindings(
  result: Awaited<ReturnType<typeof buildDependencyScanResult>>,
  options: ScanCommandOptions,
): void {
  if (options.orphans) printOrphanFiles(result.orphanFiles);
  if (options.unusedExports) printUnusedExports(result);
  if (options.unresolved) printUnresolvedImports(result.unresolvedImports);
}

function formatDependencyResult(
  result: Awaited<ReturnType<typeof buildDependencyScanResult>>,
  format: ScanOutputFormat,
): string {
  if (format === 'mermaid') return formatAsMermaid(result);
  if (format === 'dot') return formatAsDot(result);
  if (format === 'sarif') return formatAsSarif(result);
  return serializeGraphData(toDependencyGraphData(result));
}

async function runJsonOutput(
  rootDir: string,
  options: ScanCommandOptions,
  outputFormat: ScanOutputFormat,
): Promise<void> {
  let output: string;
  let validation: RuleValidationResult | undefined;

  if (parseMode(options.mode) === 'dependencies' || outputFormat !== 'json') {
    const result = await buildDependencyScanResult(rootDir, options);
    reportRequestedFindings(result, options);
    validation = result.ruleValidation;
    output = formatDependencyResult(result, outputFormat);
  } else {
    const graph = await buildSelectedGraphData(rootDir, options);
    validation = graph.ruleValidation;
    output = serializeGraphData(graph);
  }

  if (options.validate) printRuleViolations(validation);
  if (options.output) {
    const outputPath = path.resolve(options.output);
    await ensureDirectory(path.dirname(outputPath));
    await fs.writeFile(outputPath, output, 'utf-8');
    process.stderr.write(`Output written to ${outputPath}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }
  if (options.validate && validation?.errorCount) process.exitCode = 1;
}

async function runFixes(rootDir: string, options: ScanCommandOptions): Promise<void> {
  const actions = planFixes(await buildDependencyScanResult(rootDir, options));
  printFixPlan(actions, Boolean(options.dryRun));
  if (!options.dryRun && actions.length > 0) {
    await confirmFixes(options.yes);
    printFixSummary(await applyFixes(actions));
  }
}

async function runStaticExport(
  rootDir: string,
  options: ScanCommandOptions,
  initialDepth: number | 'all',
): Promise<void> {
  const { graphSet } = await buildGraphSet(rootDir, options);
  const validation = graphSet.graphs.dependencies?.ruleValidation;
  if (options.validate) printRuleViolations(validation);
  const indexPath = await createStaticExport(
    path.join(rootDir, '.depxray'),
    graphSet,
    initialDepth,
  );
  process.stderr.write(`Static export written to ${indexPath}\n`);
  if (options.validate && validation?.errorCount) process.exitCode = 1;
}

async function runBrowser(
  rootDir: string,
  options: ScanCommandOptions,
  initialDepth: number | 'all',
  port: number,
): Promise<never> {
  const scanSession = options.watch
    ? new ProjectScanSession(createDependencyScanOptions(rootDir, options))
    : undefined;
  const { tree, graphSet } = await buildGraphSet(rootDir, options, scanSession);
  const dependencyResult = graphSet.graphs.dependencies;
  if (options.orphans) printOrphanFiles(dependencyResult?.orphanFiles ?? []);
  if (options.unusedExports || options.unresolved) {
    reportRequestedFindings(
      await buildDependencyScanResult(rootDir, options, scanSession),
      options,
    );
  }
  if (options.validate) {
    const validation = dependencyResult?.ruleValidation;
    printRuleViolations(validation);
    if (validation?.errorCount) process.exitCode = 1;
  }

  const server = await startGraphServer(rootDir, tree, graphSet, port, initialDepth);
  const watcher =
    options.watch && scanSession
      ? await startWatchMode(rootDir, options, server, scanSession)
      : null;
  if (options.open !== false) {
    await openBrowser(
      `http://127.0.0.1:${server.port}?depth=${encodeURIComponent(normalizeInitialDepth(initialDepth))}&mode=${encodeURIComponent(graphSet.defaultMode)}`,
    );
  }

  const shutdown = () => {
    void Promise.resolve(watcher?.close())
      .then(() => server.close())
      .finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return new Promise<never>(() => undefined);
}

export function createScanCommand(): Command {
  const command = new Command('scan')
    .description('Scan a project and open a structure or dependency graph in a local browser')
    .argument('[dir]', 'Project directory to scan (default: current directory)', '.')
    .option('--json', 'Print the graph JSON to stdout')
    .option('--html', 'Generate a static HTML export in .depxray/')
    .option('-o, --output <file>', 'Write output to a file instead of stdout')
    .option('--mode <mode>', 'Graph mode: structure | dependencies', 'structure')
    .option('--format <format>', 'Output format for --json: json | mermaid | dot | sarif', 'json')
    .option('--ignore <patterns...>', 'Additional directory/file patterns to ignore')
    .option('--no-circular', 'Skip circular dependency detection in dependency mode')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution in dependency mode')
    .option('--orphans', 'Print orphan files to stderr after dependency scanning')
    .option('--unused-exports', 'Print unused exports to stderr after dependency scanning')
    .option('--unresolved', 'Print unresolved imports to stderr after dependency scanning')
    .option('--deps', 'Include unused and unlisted npm dependency analysis in dependency JSON')
    .option(
      '--validate',
      'Validate dependency edges against architecture rules from depxray config',
    )
    .option(
      '--fix',
      'Apply safe autofixes for unused exports, orphan files, import conventions, and --deps findings',
    )
    .option('--dry-run', 'Show autofix actions without modifying files')
    .option('--yes', 'Apply autofixes without prompting for confirmation')
    .option('--ignore-type-imports', 'Ignore type-only imports for devDependency production checks')
    .option(
      '--prod-entry-points <patterns...>',
      'Production entry point patterns for devDependency checks',
    )
    .option(
      '--dev-entry-points <patterns...>',
      'Development-only entry point patterns for devDependency checks',
    )
    .option(
      '--entry-points <patterns...>',
      'Entry point glob patterns to exclude from orphan detection',
    )
    .option(
      '--extensions <exts...>',
      'File extensions to scan in dependency mode (default: .js .jsx .ts .tsx)',
    )
    .option('--depth <depth>', 'Initial visible depth: integer >= 1 or all', '2')
    .option('--port <port>', 'Port for the local browser server', '5178')
    .option('--watch', 'Watch for file changes and update the browser UI live')
    .option('--no-open', 'Do not open the browser automatically')
    .action(async (directory: string, rawOptions: ScanCommandOptions) => {
      try {
        const rootDir = path.resolve(directory);
        const config = await loadConfig(rootDir);
        const options = mergeScanOptionsWithConfig(rawOptions, config, (name) =>
          command.getOptionValueSource(name),
        );
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const initialDepth = parseDepth(options.depth);
        const port = parsePort(options.port);
        const outputFormat = parseOutputFormat(options.format);
        validateScanCommandOptions(options, outputFormat);
        await verifyDirectory(rootDir);
        process.stderr.write(`Scanning ${rootDir}...\n`);

        if (options.fix) await runFixes(rootDir, options);
        else if (options.json) await runJsonOutput(rootDir, options, outputFormat);
        else if (options.html) await runStaticExport(rootDir, options, initialDepth);
        else await runBrowser(rootDir, options, initialDepth, port);
      } catch (error) {
        console.error(`Scan failed: ${(error as Error).message}`);
        process.exitCode = 1;
      }
    });
  return command;
}
