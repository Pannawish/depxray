import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { loadPlugins } from '../plugins.js';
import { buildCheckSummary, CHECK_ISSUE_TYPES, compareCheckResults } from '../checkBaseline.js';
import { withGitSnapshot } from '../gitSnapshot.js';
import {
  computeHealthScore,
  loadConfig,
  scanProject,
  type DepxrayConfig,
  type DepxrayPlugin,
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
  base?: string;
  maxHealthDrop?: string;
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
      : (config.ignore ?? rawOptions.ignore),
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : (config.extensions ?? rawOptions.extensions),
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : (config.circular ?? rawOptions.circular),
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : (config.aliases ?? rawOptions.aliases),
    entryPoints: cliOptionWasProvided(getOptionSource, 'entryPoints')
      ? rawOptions.entryPoints
      : (config.entryPoints ?? rawOptions.entryPoints),
    ignoreTypeImports: cliOptionWasProvided(getOptionSource, 'ignoreTypeImports')
      ? rawOptions.ignoreTypeImports
      : (config.ignoreTypeImports ?? rawOptions.ignoreTypeImports),
    rules: config.rules ?? rawOptions.rules,
    prodEntryPoints: cliOptionWasProvided(getOptionSource, 'prodEntryPoints')
      ? rawOptions.prodEntryPoints
      : (config.prodEntryPoints ?? rawOptions.prodEntryPoints),
    devEntryPoints: cliOptionWasProvided(getOptionSource, 'devEntryPoints')
      ? rawOptions.devEntryPoints
      : (config.devEntryPoints ?? rawOptions.devEntryPoints),
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

function parseNonNegativeNumber(value: string | undefined, optionName: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${optionName} must be a non-negative number.`);
  }
  return parsed;
}

export function createCheckCommand(): Command {
  const cmd = new Command('check')
    .description('Run dependency health checks for CI and exit non-zero on findings')
    .argument('[dir]', 'Project directory to scan', '.')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--json', 'Print machine-readable JSON')
    .option('--base <ref>', 'Compare with a Git ref and fail only on new findings')
    .option('--max-health-drop <points>', 'Maximum allowed health-score drop from --base')
    .option('--ignore <patterns...>', 'Additional patterns to ignore')
    .option('--extensions <exts...>', 'File extensions to scan')
    .option('--entry-points <patterns...>', 'Entry point patterns to exclude from orphan detection')
    .option(
      '--prod-entry-points <patterns...>',
      'Production entry point patterns for devDependency checks',
    )
    .option(
      '--dev-entry-points <patterns...>',
      'Development-only entry point patterns for devDependency checks',
    )
    .option('--ignore-type-imports', 'Ignore type-only imports for devDependency production checks')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .action(async (dir: string, rawOptions: CheckOptions) => {
      try {
        const rootDir = path.resolve(dir);
        await verifyDirectory(rootDir);
        const config = await loadConfig(rootDir);
        const options = mergeOptionsWithConfig(rawOptions, config, (name) =>
          cmd.getOptionValueSource(name),
        );
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const format = rawOptions.json ? 'json' : parseFormat(options.format);
        const maxHealthDrop = parseNonNegativeNumber(options.maxHealthDrop, '--max-health-drop');
        if (maxHealthDrop !== undefined && !options.base) {
          throw new Error('--max-health-drop requires --base.');
        }
        const scanOptions = {
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
        };
        const result = await scanProject(scanOptions);
        const check = buildCheckSummary(result);
        let baseline;

        if (options.base) {
          const baselineResult = await withGitSnapshot(rootDir, options.base, (snapshotRoot) =>
            scanProject({ ...scanOptions, rootDir: snapshotRoot }),
          );
          const comparison = compareCheckResults(baselineResult, result);
          const currentHealth = computeHealthScore(result).score;
          const baselineHealth = computeHealthScore(baselineResult).score;
          const healthDrop = Math.max(0, baselineHealth - currentHealth);
          const healthPassed = maxHealthDrop === undefined || healthDrop <= maxHealthDrop;
          baseline = {
            ref: options.base,
            summary: buildCheckSummary(baselineResult).summary,
            ...comparison,
            health: {
              baseline: baselineHealth,
              current: currentHealth,
              drop: healthDrop,
              allowedDrop: maxHealthDrop,
              passed: healthPassed,
            },
          };
          check.clean = comparison.newIssueCount === 0 && healthPassed;
        }

        if (format === 'json') {
          process.stdout.write(
            JSON.stringify({ ...check, ...(baseline ? { baseline } : {}), result }, null, 2) + '\n',
          );
        } else {
          process.stdout.write(check.clean ? 'depxray check passed.\n' : 'depxray check failed.\n');
          for (const [key, value] of Object.entries(check.summary)) {
            process.stdout.write(`  ${key}: ${value}\n`);
          }
          if (baseline) {
            process.stdout.write(`  baseline: ${baseline.ref}\n`);
            process.stdout.write(`  new issues: ${baseline.newIssueCount}\n`);
            process.stdout.write(`  resolved issues: ${baseline.resolvedIssueCount}\n`);
            for (const type of CHECK_ISSUE_TYPES) {
              for (const issue of baseline.newIssues[type]) {
                process.stdout.write(`    + ${type}: ${issue}\n`);
              }
            }
            if (maxHealthDrop !== undefined) {
              process.stdout.write(
                `  health score drop: ${baseline.health.drop} (allowed ${maxHealthDrop})\n`,
              );
            }
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
