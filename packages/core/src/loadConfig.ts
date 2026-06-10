import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DepxrayConfig } from './types.js';

type ConfigRecord = Record<string, unknown>;

const CONFIG_FILES = [
  'depxray.config.js',
  'depxray.config.mjs',
  '.depxrayrc.json',
] as const;

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
  key: 'ignore' | 'extensions' | 'entryPoints',
  source: string,
): string[] | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`Invalid depxray config in ${source}: ${key} must be an array of non-empty strings.`);
  }

  return value;
}

function readBoolean(
  record: ConfigRecord,
  key: 'circular' | 'aliases',
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
    throw new Error(`Invalid depxray config in ${source}: mode must be "structure" or "dependencies".`);
  }

  return value;
}

function readPort(record: ConfigRecord, source: string): number | undefined {
  const value = record.port;
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65535) {
    throw new Error(`Invalid depxray config in ${source}: port must be an integer between 1 and 65535.`);
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

function normalizeConfig(value: unknown, source: string): DepxrayConfig {
  const record = assertPlainObject(value, source);

  return {
    ignore: readStringArray(record, 'ignore', source),
    extensions: readStringArray(record, 'extensions', source),
    entryPoints: readStringArray(record, 'entryPoints', source),
    mode: readMode(record, source),
    circular: readBoolean(record, 'circular', source),
    aliases: readBoolean(record, 'aliases', source),
    port: readPort(record, source),
    depth: readDepth(record, source),
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
