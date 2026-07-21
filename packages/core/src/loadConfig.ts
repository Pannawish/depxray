import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DepxrayConfig } from './types.js';

type ConfigRecord = Record<string, unknown>;

const CONFIG_FILES = ['depxray.config.js', 'depxray.config.mjs', '.depxrayrc.json'] as const;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertPlainObject(value: unknown, source: string): ConfigRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid depxray config in ${source}: expected an object.`);
  }

  return value as ConfigRecord;
}

function readStringArray(
  record: ConfigRecord,
  key: 'ignore' | 'extensions' | 'entryPoints' | 'prodEntryPoints' | 'devEntryPoints',
  source: string,
): string[] | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new Error(
      `Invalid depxray config in ${source}: ${key} must be an array of non-empty strings.`,
    );
  }

  return value;
}

function readBoolean(
  record: ConfigRecord,
  key: 'circular' | 'aliases' | 'ignoreTypeImports',
  source: string,
): boolean | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Invalid depxray config in ${source}: ${key} must be a boolean.`);
  }

  return value;
}

function readMode(record: ConfigRecord, source: string): DepxrayConfig['mode'] {
  const value = record.mode;
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'structure' && value !== 'dependencies') {
    throw new Error(
      `Invalid depxray config in ${source}: mode must be "structure" or "dependencies".`,
    );
  }

  return value;
}

function readPort(record: ConfigRecord, source: string): number | undefined {
  const value = record.port;
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65535) {
    throw new Error(
      `Invalid depxray config in ${source}: port must be an integer between 1 and 65535.`,
    );
  }

  return value as number;
}

function readDepth(record: ConfigRecord, source: string): DepxrayConfig['depth'] {
  const value = record.depth;
  if (value === undefined) {
    return undefined;
  }

  if (value === 'all') {
    return value;
  }

  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Invalid depxray config in ${source}: depth must be an integer >= 1 or "all".`);
  }

  return value as number;
}

function readRules(record: ConfigRecord, source: string): DepxrayConfig['rules'] {
  const value = record.rules;
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid depxray config in ${source}: rules must be an array.`);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Invalid depxray config in ${source}: rules[${index}] must be an object.`);
    }

    const rule = item as ConfigRecord;
    const hasGlobalRule = rule.from !== undefined || rule.to !== undefined;
    const hasScopedRule = rule.entryPoints !== undefined || rule.deny !== undefined;

    if (hasGlobalRule) {
      if (typeof rule.from !== 'string' || rule.from.length === 0) {
        throw new Error(
          `Invalid depxray config in ${source}: rules[${index}].from must be a non-empty string.`,
        );
      }
      if (typeof rule.to !== 'string' || rule.to.length === 0) {
        throw new Error(
          `Invalid depxray config in ${source}: rules[${index}].to must be a non-empty string.`,
        );
      }
    }

    if (hasScopedRule) {
      if (
        !Array.isArray(rule.entryPoints) ||
        rule.entryPoints.some(
          (entryPoint) => typeof entryPoint !== 'string' || entryPoint.length === 0,
        )
      ) {
        throw new Error(
          `Invalid depxray config in ${source}: rules[${index}].entryPoints must be an array of non-empty strings.`,
        );
      }
      if (!rule.deny || typeof rule.deny !== 'object' || Array.isArray(rule.deny)) {
        throw new Error(
          `Invalid depxray config in ${source}: rules[${index}].deny must be an object.`,
        );
      }
      const deny = rule.deny as ConfigRecord;
      for (const key of ['files', 'modules'] as const) {
        const value = deny[key];
        if (
          value !== undefined &&
          (!Array.isArray(value) ||
            value.some((item) => typeof item !== 'string' || item.length === 0))
        ) {
          throw new Error(
            `Invalid depxray config in ${source}: rules[${index}].deny.${key} must be an array of non-empty strings.`,
          );
        }
      }
    }

    if (!hasGlobalRule && !hasScopedRule) {
      throw new Error(
        `Invalid depxray config in ${source}: rules[${index}] must define from/to or entryPoints/deny.`,
      );
    }

    if (rule.severity !== undefined && rule.severity !== 'error' && rule.severity !== 'warning') {
      throw new Error(
        `Invalid depxray config in ${source}: rules[${index}].severity must be "error" or "warning".`,
      );
    }
    if (rule.message !== undefined && typeof rule.message !== 'string') {
      throw new Error(
        `Invalid depxray config in ${source}: rules[${index}].message must be a string.`,
      );
    }

    return {
      ...(rule.from ? { from: rule.from as string } : {}),
      ...(rule.to ? { to: rule.to as string } : {}),
      ...(rule.entryPoints ? { entryPoints: rule.entryPoints as string[] } : {}),
      ...(rule.deny ? { deny: rule.deny as { files?: string[]; modules?: string[] } } : {}),
      ...(rule.severity ? { severity: rule.severity as 'error' | 'warning' } : {}),
      ...(rule.message ? { message: rule.message as string } : {}),
    };
  });
}

function readImportConventions(
  record: ConfigRecord,
  source: string,
): DepxrayConfig['importConventions'] {
  const value = record.importConventions;
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid depxray config in ${source}: importConventions must be an object.`);
  }

  const config = value as ConfigRecord;
  if (config.prefer !== undefined && config.prefer !== 'relative' && config.prefer !== 'absolute') {
    throw new Error(
      `Invalid depxray config in ${source}: importConventions.prefer must be "relative" or "absolute".`,
    );
  }

  for (const key of ['aliasPrefix', 'root'] as const) {
    if (
      config[key] !== undefined &&
      (typeof config[key] !== 'string' || config[key].length === 0)
    ) {
      throw new Error(
        `Invalid depxray config in ${source}: importConventions.${key} must be a non-empty string.`,
      );
    }
  }

  return {
    ...(config.prefer ? { prefer: config.prefer as 'relative' | 'absolute' } : {}),
    ...(config.aliasPrefix ? { aliasPrefix: config.aliasPrefix as string } : {}),
    ...(config.root ? { root: config.root as string } : {}),
  };
}

function readPlugins(record: ConfigRecord, source: string): DepxrayConfig['plugins'] {
  const value = record.plugins;
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid depxray config in ${source}: plugins must be an array.`);
  }

  return value.map((item, index) => {
    if (typeof item === 'string') {
      if (item.length === 0) {
        throw new Error(
          `Invalid depxray config in ${source}: plugins[${index}] must be a non-empty string or plugin object.`,
        );
      }
      return item;
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(
        `Invalid depxray config in ${source}: plugins[${index}] must be a non-empty string or plugin object.`,
      );
    }

    const plugin = item as ConfigRecord;
    if (plugin.name !== undefined && typeof plugin.name !== 'string') {
      throw new Error(
        `Invalid depxray config in ${source}: plugins[${index}].name must be a string.`,
      );
    }

    for (const hookName of ['afterScan', 'afterBuildGraph', 'onReport'] as const) {
      if (plugin[hookName] !== undefined && typeof plugin[hookName] !== 'function') {
        throw new Error(
          `Invalid depxray config in ${source}: plugins[${index}].${hookName} must be a function.`,
        );
      }
    }

    return item as NonNullable<DepxrayConfig['plugins']>[number];
  });
}

function normalizeConfig(value: unknown, source: string): DepxrayConfig {
  const record = assertPlainObject(value, source);

  return {
    ignore: readStringArray(record, 'ignore', source),
    extensions: readStringArray(record, 'extensions', source),
    entryPoints: readStringArray(record, 'entryPoints', source),
    prodEntryPoints: readStringArray(record, 'prodEntryPoints', source),
    devEntryPoints: readStringArray(record, 'devEntryPoints', source),
    mode: readMode(record, source),
    circular: readBoolean(record, 'circular', source),
    aliases: readBoolean(record, 'aliases', source),
    ignoreTypeImports: readBoolean(record, 'ignoreTypeImports', source),
    port: readPort(record, source),
    depth: readDepth(record, source),
    rules: readRules(record, source),
    importConventions: readImportConventions(record, source),
    plugins: readPlugins(record, source),
  };
}

async function loadJavaScriptConfig(filePath: string): Promise<unknown> {
  const moduleUrl = pathToFileURL(filePath);
  moduleUrl.searchParams.set('mtime', String((await fs.stat(filePath)).mtimeMs));
  const module = await import(moduleUrl.href);
  return module.default ?? module;
}

async function loadJsonConfig(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
}

async function loadPackageJsonConfig(filePath: string): Promise<unknown | undefined> {
  const packageJson = assertPlainObject(
    JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown,
    'package.json',
  );
  return packageJson.depxray;
}

/**
 * Load the first depxray configuration found in a project root.
 *
 * Search order:
 * 1. depxray.config.js
 * 2. depxray.config.mjs
 * 3. .depxrayrc.json
 * 4. package.json's depxray key
 */
export async function loadConfig(rootDir: string): Promise<DepxrayConfig> {
  const resolvedRoot = path.resolve(rootDir);

  for (const configFileName of CONFIG_FILES) {
    const configPath = path.join(resolvedRoot, configFileName);
    if (!(await pathExists(configPath))) {
      continue;
    }

    const rawConfig = configFileName.endsWith('.json')
      ? await loadJsonConfig(configPath)
      : await loadJavaScriptConfig(configPath);
    return normalizeConfig(rawConfig, configFileName);
  }

  const packageJsonPath = path.join(resolvedRoot, 'package.json');
  if (await pathExists(packageJsonPath)) {
    const packageConfig = await loadPackageJsonConfig(packageJsonPath);
    if (packageConfig !== undefined) {
      return normalizeConfig(packageConfig, 'package.json#depxray');
    }
  }

  return {};
}
