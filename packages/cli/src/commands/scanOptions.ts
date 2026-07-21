import type { DepxrayConfig, DepxrayPlugin, ExplorerGraphMode, ScanOptions } from '@depxray/core';

export type GraphMode = ExplorerGraphMode;
export type ScanOutputFormat = 'json' | 'mermaid' | 'dot' | 'sarif';

export interface ScanCommandOptions {
  json?: boolean;
  html?: boolean;
  output?: string;
  ignore?: string[];
  depth?: string;
  port?: string;
  mode?: string;
  format?: string;
  circular?: boolean;
  aliases?: boolean;
  extensions?: string[];
  orphans?: boolean;
  unusedExports?: boolean;
  unresolved?: boolean;
  deps?: boolean;
  validate?: boolean;
  fix?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  ignoreTypeImports?: boolean;
  rules?: DepxrayConfig['rules'];
  prodEntryPoints?: string[];
  devEntryPoints?: string[];
  importConventions?: DepxrayConfig['importConventions'];
  plugins?: DepxrayPlugin[];
  entryPoints?: string[];
  open?: boolean;
  watch?: boolean;
}

type OptionSourceReader = (name: string) => string | undefined;

export function parseDepth(value: string | undefined): number | 'all' {
  if (!value) return 2;
  if (value === 'all') return 'all';

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid depth: ${value}. Use an integer >= 1 or "all".`);
  }
  return parsed;
}

export function parsePort(value: string | undefined): number {
  if (!value) return 5178;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}. Use a number between 1 and 65535.`);
  }
  return parsed;
}

export function parseMode(value: string | undefined): GraphMode {
  if (!value || value === 'structure') return 'structure';
  if (value === 'dependencies') return 'dependencies';
  throw new Error(`Invalid mode: ${value}. Use "structure" or "dependencies".`);
}

export function parseOutputFormat(value: string | undefined): ScanOutputFormat {
  if (!value || value === 'json') return 'json';
  if (value === 'mermaid' || value === 'dot' || value === 'sarif') return value;
  throw new Error(`Invalid format: ${value}. Use "json", "mermaid", "dot", or "sarif".`);
}

function cliOptionWasProvided(getOptionSource: OptionSourceReader, name: string): boolean {
  return getOptionSource(name) === 'cli';
}

export function mergeScanOptionsWithConfig(
  rawOptions: ScanCommandOptions,
  config: DepxrayConfig,
  getOptionSource: OptionSourceReader = () => undefined,
): ScanCommandOptions {
  return {
    ...rawOptions,
    ignore: cliOptionWasProvided(getOptionSource, 'ignore')
      ? rawOptions.ignore
      : (config.ignore ?? rawOptions.ignore),
    mode: cliOptionWasProvided(getOptionSource, 'mode')
      ? rawOptions.mode
      : (config.mode ?? rawOptions.mode),
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : (config.circular ?? rawOptions.circular),
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : (config.aliases ?? rawOptions.aliases),
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : (config.extensions ?? rawOptions.extensions),
    entryPoints: cliOptionWasProvided(getOptionSource, 'entryPoints')
      ? rawOptions.entryPoints
      : (config.entryPoints ?? rawOptions.entryPoints),
    depth: cliOptionWasProvided(getOptionSource, 'depth')
      ? rawOptions.depth
      : config.depth === undefined
        ? rawOptions.depth
        : String(config.depth),
    port: cliOptionWasProvided(getOptionSource, 'port')
      ? rawOptions.port
      : config.port === undefined
        ? rawOptions.port
        : String(config.port),
    rules: config.rules ?? rawOptions.rules,
    prodEntryPoints: cliOptionWasProvided(getOptionSource, 'prodEntryPoints')
      ? rawOptions.prodEntryPoints
      : (config.prodEntryPoints ?? rawOptions.prodEntryPoints),
    devEntryPoints: cliOptionWasProvided(getOptionSource, 'devEntryPoints')
      ? rawOptions.devEntryPoints
      : (config.devEntryPoints ?? rawOptions.devEntryPoints),
    ignoreTypeImports: cliOptionWasProvided(getOptionSource, 'ignoreTypeImports')
      ? rawOptions.ignoreTypeImports
      : (config.ignoreTypeImports ?? rawOptions.ignoreTypeImports),
    importConventions: config.importConventions ?? rawOptions.importConventions,
    plugins: rawOptions.plugins,
  };
}

export function createDependencyScanOptions(
  rootDir: string,
  options: ScanCommandOptions,
): ScanOptions {
  return {
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
    entryPointPatterns: options.entryPoints,
    detectUnusedDeps: options.deps,
    rules: options.rules,
    prodEntryPoints: options.prodEntryPoints,
    devEntryPoints: options.devEntryPoints,
    ignoreTypeImports: options.ignoreTypeImports,
    importConventions: options.importConventions,
    plugins: options.plugins,
  };
}

export function validateScanCommandOptions(
  options: ScanCommandOptions,
  outputFormat: ScanOutputFormat,
): void {
  if (options.json && options.html)
    throw new Error('Choose only one output mode: --json or --html.');
  if (options.output && !options.json)
    throw new Error('--output is only supported together with --json.');
  if (options.watch && (options.json || options.html)) {
    throw new Error('--watch is only supported with the local browser UI.');
  }
  if (options.dryRun && !options.fix)
    throw new Error('--dry-run is only supported together with --fix.');
  if (options.deps && options.json && parseMode(options.mode) !== 'dependencies') {
    throw new Error('--deps is only supported with --mode dependencies when using --json.');
  }
  if (options.validate && (!options.rules || options.rules.length === 0)) {
    throw new Error('--validate requires rules in depxray config.');
  }
  if (options.validate && options.json && parseMode(options.mode) !== 'dependencies') {
    throw new Error('--validate is only supported with --mode dependencies when using --json.');
  }
  if (options.unusedExports && options.json && parseMode(options.mode) !== 'dependencies') {
    throw new Error(
      '--unused-exports is only supported with --mode dependencies when using --json.',
    );
  }
  if (options.unresolved && options.json && parseMode(options.mode) !== 'dependencies') {
    throw new Error('--unresolved is only supported with --mode dependencies when using --json.');
  }
  if (outputFormat !== 'json' && !options.json) {
    throw new Error('--format is only supported together with --json.');
  }
  if (outputFormat !== 'json' && parseMode(options.mode) !== 'dependencies') {
    throw new Error('--format mermaid|dot|sarif is only supported with --mode dependencies.');
  }
}
