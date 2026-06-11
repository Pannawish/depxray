import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { loadPlugins } from '../plugins.js';
import {
  analyzeImpact,
  loadConfig,
  scanProject,
  type DepxrayConfig,
  type DepxrayPlugin,
  type ImpactAnalysisResult,
} from '@depxray/core';

interface ImpactCommandOptions {
  json?: boolean;
  format?: string;
  ignore?: string[];
  extensions?: string[];
  aliases?: boolean;
  circular?: boolean;
  complexityThreshold?: number;
  impactThreshold?: number;
  inboundThreshold?: number;
  plugins?: DepxrayPlugin[];
}

type OptionSourceReader = (name: string) => string | undefined;

function cliOptionWasProvided(getOptionSource: OptionSourceReader, name: string): boolean {
  return getOptionSource(name) === 'cli';
}

function mergeOptionsWithConfig(
  rawOptions: ImpactCommandOptions,
  config: DepxrayConfig,
  getOptionSource: OptionSourceReader,
): ImpactCommandOptions {
  return {
    ...rawOptions,
    ignore: cliOptionWasProvided(getOptionSource, 'ignore')
      ? rawOptions.ignore
      : config.ignore ?? rawOptions.ignore,
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : config.aliases ?? rawOptions.aliases,
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : config.circular ?? rawOptions.circular,
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : config.extensions ?? rawOptions.extensions,
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

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

async function verifyDirectory(rootDir: string): Promise<void> {
  const stat = await fs.stat(rootDir);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }
}

function formatRiskFactors(factors: string[]): string {
  return factors.length > 0 ? factors.join(', ') : 'no elevated factors';
}

function printImpactText(impact: ImpactAnalysisResult): string {
  const lines = [
    `Impact for ${impact.target.file}`,
    `Risk: ${impact.risk}`,
    `Affected files: ${impact.affectedCount} (${impact.directDependentCount} direct, max depth ${impact.maxDistance})`,
    `Target signals: ${formatRiskFactors(impact.target.riskFactors)}`,
    '',
  ];

  if (impact.highImpactComplexFiles.length > 0) {
    lines.push('High-impact + high-complexity files:');
    for (const file of impact.highImpactComplexFiles) {
      lines.push(`  ${file.file} (${formatRiskFactors(file.riskFactors)})`);
    }
    lines.push('');
  }

  if (impact.directDependents.length > 0) {
    lines.push('Direct dependents:');
    for (const file of impact.directDependents) {
      lines.push(`  ${file.file}`);
    }
    lines.push('');
  }

  if (impact.affectedFiles.length > 0) {
    lines.push('Blast radius:');
    for (const file of impact.affectedFiles) {
      lines.push(`  ${file.file} (distance ${file.distance}, risk ${file.risk})`);
      lines.push(`    ${file.path.join(' -> ')}`);
    }
  } else {
    lines.push('Blast radius: none');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function createImpactCommand(): Command {
  const cmd = new Command('impact')
    .description('Analyze which files transitively depend on a target file')
    .argument('<file>', 'Target file to analyze')
    .argument('[dir]', 'Project directory to scan', '.')
    .option('--json', 'Print machine-readable JSON')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--ignore <patterns...>', 'Additional patterns to ignore')
    .option('--extensions <exts...>', 'File extensions to scan')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .option('--complexity-threshold <number>', 'Complexity score considered high', parsePositiveInteger)
    .option('--impact-threshold <number>', 'Transitive dependent count considered high-impact', parsePositiveInteger)
    .option('--inbound-threshold <number>', 'Incoming import count considered high-impact', parsePositiveInteger)
    .action(async (file: string, dir: string, rawOptions: ImpactCommandOptions) => {
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
          detectCircular: options.circular !== false,
          resolveAliases: options.aliases !== false,
          extensions: options.extensions,
          plugins: options.plugins,
        });
        const impact = analyzeImpact(result.graph, file, {
          complexityThreshold: options.complexityThreshold,
          impactThreshold: options.impactThreshold,
          inboundThreshold: options.inboundThreshold,
        });

        if (format === 'json') {
          process.stdout.write(JSON.stringify(impact, null, 2) + '\n');
          return;
        }

        process.stdout.write(printImpactText(impact));
      } catch (err) {
        console.error(`impact failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
