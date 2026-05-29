// ============================================================================
// configLoader — Load path aliases from tsconfig.json / jsconfig.json
// ============================================================================
// Parses the `compilerOptions.paths` and `compilerOptions.baseUrl` fields
// from tsconfig.json (or jsconfig.json) to build alias mappings.
//
// Example tsconfig.json:
//   {
//     "compilerOptions": {
//       "baseUrl": ".",
//       "paths": {
//         "@/*": ["./src/*"],
//         "@components/*": ["./src/components/*"]
//       }
//     }
//   }
//
// This produces aliases:
//   [
//     { prefix: '@/', paths: ['/abs/path/to/src/'] },
//     { prefix: '@components/', paths: ['/abs/path/to/src/components/'] }
//   ]
// ============================================================================

import * as path from 'path';
import * as fs from 'fs';
import type { AliasMapping } from './types.js';

/**
 * Strip JSON comments (single-line // and multi-line) and trailing commas
 * so that JSON.parse can handle tsconfig.json files, which allow comments.
 */
function stripJsonComments(jsonString: string): string {
  // Remove single-line comments
  let result = jsonString.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([\]}])/g, '$1');
  return result;
}

/**
 * Read and parse a JSON config file, handling comments and trailing commas
 * (which are allowed in tsconfig.json but not standard JSON).
 */
function readJsonConfig(
  configPath: string,
): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cleaned = stripJsonComments(raw);
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Resolve the `extends` chain in tsconfig.json to merge configurations.
 *
 * Many projects use `"extends": "@tsconfig/react-native"` or similar.
 * We follow the chain to find `paths` definitions in parent configs.
 */
function resolveExtendsChain(
  configPath: string,
  visited: Set<string> = new Set(),
): Record<string, unknown> {
  const absPath = path.resolve(configPath);

  // Prevent infinite loops
  if (visited.has(absPath)) {
    return {};
  }
  visited.add(absPath);

  const config = readJsonConfig(absPath);
  if (!config) {
    return {};
  }

  // If this config extends another, merge them
  if (typeof config.extends === 'string') {
    let parentPath = config.extends;

    // Resolve the parent config path
    if (parentPath.startsWith('.')) {
      parentPath = path.resolve(path.dirname(absPath), parentPath);
    } else {
      // It's a package reference like "@tsconfig/react"
      // Try to resolve it from node_modules
      try {
        parentPath = require.resolve(parentPath, {
          paths: [path.dirname(absPath)],
        });
      } catch {
        // Can't resolve the parent — skip it
        return config;
      }
    }

    // Ensure .json extension
    if (!parentPath.endsWith('.json')) {
      parentPath += '.json';
    }

    const parentConfig = resolveExtendsChain(parentPath, visited);

    // Merge: child overrides parent
    return {
      ...parentConfig,
      ...config,
      compilerOptions: {
        ...(parentConfig.compilerOptions as Record<string, unknown> || {}),
        ...(config.compilerOptions as Record<string, unknown> || {}),
      },
    };
  }

  return config;
}

/**
 * Load path alias mappings from tsconfig.json or jsconfig.json.
 *
 * Tries tsconfig.json first, then falls back to jsconfig.json.
 * Follows the `extends` chain to find inherited path mappings.
 *
 * @param rootDir - The project root directory
 * @returns Array of alias mappings, empty if none found
 *
 * @example
 * ```typescript
 * const aliases = loadAliases('/path/to/project');
 * // [{ prefix: '@/', paths: ['/path/to/project/src/'] }]
 * ```
 */
export function loadAliases(rootDir: string): AliasMapping[] {
  // Try tsconfig.json first, then jsconfig.json
  const configNames = ['tsconfig.json', 'jsconfig.json'];

  for (const configName of configNames) {
    const configPath = path.join(rootDir, configName);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    const config = resolveExtendsChain(configPath);
    const compilerOptions = config.compilerOptions as Record<string, unknown> | undefined;

    if (!compilerOptions) {
      continue;
    }

    const baseUrl = (compilerOptions.baseUrl as string) || '.';
    const paths = (compilerOptions.paths as Record<string, string[]>) || {};

    // No path mappings defined
    if (Object.keys(paths).length === 0) {
      continue;
    }

    const absoluteBaseUrl = path.resolve(rootDir, baseUrl);

    const aliases: AliasMapping[] = Object.entries(paths).map(
      ([pattern, targets]) => ({
        // Remove the wildcard: '@/*' → '@/'
        prefix: pattern.replace(/\*$/, ''),
        // Resolve each target to an absolute path, remove wildcard
        paths: targets.map((t) =>
          path.resolve(absoluteBaseUrl, t.replace(/\*$/, '')),
        ),
      }),
    );

    return aliases;
  }

  return [];
}
