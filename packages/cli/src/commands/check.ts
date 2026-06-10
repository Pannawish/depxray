import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { loadPlugins } from '../plugins.js';
import {
  loadConfig,
  scanProject,
  type DepxrayConfig,
  type DepxrayPlugin,
  type ScanResult,
} from '@depxray/core';

interface CheckOptions {
  format?: string;
  json?: boolean;
  ignore?: string[];
  extensions?: string[];
  circular?: boolean;
  aliases?: boolean;
  entryPoints?: string[];
  ignoreTypeImports?: boolean;
  rules?: DepxrayConfig['rules'];
  prodEntryPoints?: string[];
  devEntryPoints?: string[];
  importConventions?: DepxrayConfig['importConventions'];
  plugins?: DepxrayPlugin[];
}

type OptionSourceReader = (name: string) => string | undefined;

function cliOptionWasProvided(getOptionSource: OptionSourceReader, name: string): boolean {
  return getOptionSource(name) === 'cli';
}

function mergeOptionsWithConfig(
  rawOptions: CheckOptions,
  config: DepxrayConfig,
  getOptionSource: OptionSourceReader,
): CheckOptions {
  return {
    ...rawOptions,
    ignore: cliOptionWasProvided(getOptionSource, 'ignore')
      ? rawOptions.ignore
      : config.ignore ?? rawOptions.ignore,
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : config.extensions ?? rawOptions.extensions,
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : config.circular ?? rawOptions.circular,
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : config.aliases ?? rawOptions.aliases,
    entryPoints: cliOptionWasProvided(getOptionSource, 'entryPoints')
      ? rawOptions.entryPoints
      : config.entryPoints ?? rawOptions.entryPoints,
    ignoreTypeImports: cliOptionWasProvided(getOptionSource, 'ignoreTypeImports')
      ? rawOptions.ignoreTypeImports
      : config.ignoreTypeImports ?? rawOptions.ignoreTypeImports,
    rules: config.rules ?? rawOptions.rules,
    prodEntryPoints: cliOptionWasProvided(getOptionSource, 'prodEntryPoints')
      ? rawOptions.prodEntryPoints
      : config.prodEntryPoints ?? rawOptions.prodEntryPoints,
    devEntryPoints: cliOptionWasProvided(getOptionSource, 'devEntryPoints')
      ? rawOptions.devEntryPoints
      : config.devEntryPoints ?? rawOptions.devEntryPoints,
    importConventions: config.importConventions ?? rawOptions.importConventions,
    plugins: rawOptions.plugins,
  };
}

function parseFormat(format: string | undefined): 'text' | 'json' {
  if (!format || format === 'text') {
    return 'text';
  }
  if (format === 'json') {
    return 'json';
  }
  throw new Error(`Invalid format: ${format}. Use "text" or "json".`);
}

async function verifyDirectory(rootDir: string): Promise<void> {
  const stat = await fs.stat(rootDir);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }
}

function countUnusedExports(result: ScanResult): number {
  return result.graph.nodes.reduce((total, node) => total + (node.unusedExports?.length ?? 0), 0);
}

function buildCheckSummary(result: ScanResult) {
  const architectureErrors = result.ruleValidation?.errorCount ?? 0;
  const summary = {
    circularDependencies: result.circularCount,
    orphanFiles: result.orphanFiles.length,
    unusedExports: countUnusedExports(result),
    unresolvedImports: result.unresolvedImports.length,
    architectureErrors,
    devDepsInProd: result.devDepsInProd?.length ?? 0,
    importConventionViolations: result.importConventionViolations?.length ?? 0,
  };

  return {
    clean: Object.values(summary).every((value) => value === 0),
    summary,
  };
}

export function createCheckCommand(): Command {
  const cmd = new Command('check')
    .description('Run dependency health checks for CI and exit non-zero on findings')
    .argument('[dir]', 'Project directory to scan', '.')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--json', 'Print machine-readable JSON')
    .option('--ignore <patterns...>', 'Additional patterns to ignore')
    .option('--extensions <exts...>', 'File extensions to scan')
    .option('--entry-points <patterns...>', 'Entry point patterns to exclude from orphan detection')
    .option('--prod-entry-points <patterns...>', 'Production entry point patterns for devDependency checks')
    .option('--dev-entry-points <patterns...>', 'Development-only entry point patterns for devDependency checks')
    .option('--ignore-type-imports', 'Ignore type-only imports for devDependency production checks')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .action(async (dir: string, rawOptions: CheckOptions) => {
      try {
        const rootDir = path.resolve(dir);
        await verifyDirectory(rootDir);
        const config = await loadConfig(rootDir);
        const options = mergeOptionsWithConfig(rawOptions, config, (name) => cmd.getOptionValueSource(name));
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const format = rawOptions.json ? 'json' : parseFormat(options.format);
        const result = await scanProject({
          rootDir,
          ignorePatterns: options.ignore,
          extensions: options.extensions,
          detectCircular: options.circular !== false,
          resolveAliases: options.aliases !== false,
          entryPointPatterns: options.entryPoints,
          rules: options.rules,
          prodEntryPoints: options.prodEntryPoints,
          devEntryPoints: options.devEntryPoints,
          ignoreTypeImports: options.ignoreTypeImports,
          importConventions: options.importConventions,
          plugins: options.plugins,
        });
        const check = buildCheckSummary(result);

        if (format === 'json') {
          process.stdout.write(JSON.stringify({ ...check, result }, null, 2) + '\n');
        } else {
          process.stdout.write(check.clean ? 'depxray check passed.\n' : 'depxray check failed.\n');
          for (const [key, value] of Object.entries(check.summary)) {
            process.stdout.write(`  ${key}: ${value}\n`);
          }
        }

        if (!check.clean) {
          process.exit(1);
        }
      } catch (err) {
        console.error(`check failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
