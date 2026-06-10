import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BUILT_IN_PLUGINS,
  type DepxrayPlugin,
  type DepxrayPluginReference,
} from '@depxray/core';

const HOOK_NAMES = ['afterScan', 'afterBuildGraph', 'onReport'] as const;

function isPlugin(value: unknown): value is DepxrayPlugin {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return HOOK_NAMES.some((hookName) => typeof record[hookName] === 'function');
}

function normalizePlugin(value: unknown, specifier: string): DepxrayPlugin {
  const candidate = (
    value &&
    typeof value === 'object' &&
    'default' in value &&
    isPlugin((value as { default?: unknown }).default)
  )
    ? (value as { default: unknown }).default
    : value;

  if (isPlugin(candidate)) {
    const plugin = candidate;
    return {
      ...plugin,
      name: plugin.name ?? specifier,
    };
  }

  if (isPlugin(value)) {
    return {
      ...(value as DepxrayPlugin),
      name: (value as DepxrayPlugin).name ?? specifier,
    };
  }

  throw new Error(`Plugin "${specifier}" must export at least one depxray hook function.`);
}

async function loadPluginModule(specifier: string, rootDir: string): Promise<DepxrayPlugin> {
  const builtIn = BUILT_IN_PLUGINS[specifier];
  if (builtIn) {
    return builtIn;
  }

  const importTarget = specifier.startsWith('.') || specifier.startsWith('/')
    ? pathToFileURL(path.resolve(rootDir, specifier)).href
    : specifier;
  const module = await import(importTarget);
  return normalizePlugin(module, specifier);
}

export async function loadPlugins(
  references: DepxrayPluginReference[] | undefined,
  rootDir: string,
): Promise<DepxrayPlugin[]> {
  if (!references || references.length === 0) {
    return [];
  }

  const plugins: DepxrayPlugin[] = [];
  for (const reference of references) {
    if (typeof reference === 'string') {
      plugins.push(await loadPluginModule(reference, rootDir));
      continue;
    }

    if (!isPlugin(reference)) {
      throw new Error('Inline depxray plugins must define at least one hook function.');
    }

    plugins.push(reference);
  }

  return plugins;
}
