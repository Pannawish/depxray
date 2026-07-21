// ============================================================================
// resolveImports — Resolve import specifiers to absolute file paths
// ============================================================================
// Takes raw import specifiers (like './Button' or '@/utils') and resolves them
// to actual files on disk. Handles:
//   - Relative paths (./foo, ../bar)
//   - Extension resolution (.ts, .tsx, .js, .jsx)
//   - Index file resolution (./dir → ./dir/index.ts)
//   - Path aliases from tsconfig.json (@/ → src/)
//   - Skipping external packages (react, lodash)
// ============================================================================

import * as path from 'path';
import * as fs from 'fs';
import type { RawImportInfo, ResolvedImport, AliasMapping } from './types.js';
import { DEFAULT_EXTENSIONS } from './types.js';

/**
 * Check if an import specifier refers to an external package (not a local file).
 *
 * External packages are identified by:
 * - Not starting with '.' or '..'
 * - Not matching any configured alias prefix
 */
function isExternalImport(specifier: string, aliases: AliasMapping[]): boolean {
  // Relative imports are always local
  if (specifier.startsWith('.')) {
    return false;
  }

  // Check if it matches an alias
  for (const alias of aliases) {
    if (
      specifier === alias.prefix ||
      (alias.prefix.endsWith('/') && specifier.startsWith(alias.prefix))
    ) {
      return false;
    }
  }

  // Everything else is external (react, lodash, @mui/material, etc.)
  return true;
}

/**
 * Try to resolve a file path by testing various extensions and index files.
 *
 * Resolution order:
 * 1. Exact match (the path as-is)
 * 2. Path + each extension (.ts, .tsx, .js, .jsx)
 * 3. Path as directory + index + each extension
 *
 * @returns The resolved absolute path, or null if not found
 */
function tryResolveFile(basePath: string, extensions: string[]): string | null {
  // 1. Try exact match (e.g., importing a .json or .css file with extension)
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  // TypeScript projects commonly preserve Node-style `.js` specifiers in
  // source even though the file on disk is `.ts`/`.tsx` before compilation.
  const sourceExtensionFallbacks: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
  };
  const requestedExtension = path.extname(basePath).toLowerCase();
  const sourceBasePath = basePath.slice(0, -requestedExtension.length);
  for (const extension of sourceExtensionFallbacks[requestedExtension] ?? []) {
    if (!extensions.includes(extension)) continue;
    const sourcePath = `${sourceBasePath}${extension}`;
    if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
      return sourcePath;
    }
  }

  // 2. Try appending each extension
  for (const ext of extensions) {
    const withExt = basePath + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  // 3. Try as a directory with index file
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = path.join(basePath, `index${ext}`);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }
  }

  return null;
}

/**
 * Resolve an alias-prefixed specifier to an absolute path.
 *
 * For example, if the alias is `@/ → /project/src/`:
 *   `@/components/Button` → `/project/src/components/Button`
 *
 * Then tries extension resolution on the resulting path.
 */
function resolveAlias(
  specifier: string,
  aliases: AliasMapping[],
  extensions: string[],
): string | null {
  for (const alias of aliases) {
    const isExactAlias = specifier === alias.prefix;
    const isPrefixAlias = alias.prefix.endsWith('/') && specifier.startsWith(alias.prefix);
    if (isExactAlias || isPrefixAlias) {
      const remainder = specifier.slice(alias.prefix.length).replace(/^[/\\]/, '');

      // Try each alias target path
      for (const aliasPath of alias.paths) {
        const fullPath = path.join(aliasPath, remainder);
        const resolved = tryResolveFile(fullPath, extensions);
        if (resolved) {
          return resolved;
        }
      }
    }
  }

  return null;
}

/**
 * Resolve a single import specifier to an absolute file path.
 *
 * @param importInfo    - The raw import extracted from the AST
 * @param importingFile - Absolute path of the file containing the import
 * @param aliases       - Path alias mappings from tsconfig.json
 * @param extensions    - File extensions to try during resolution
 * @returns A ResolvedImport with the resolved path (or null if unresolvable)
 */
export function resolveImport(
  importInfo: RawImportInfo,
  importingFile: string,
  aliases: AliasMapping[],
  extensions: string[] = DEFAULT_EXTENSIONS,
): ResolvedImport {
  const { source } = importInfo;

  // Skip external packages — they're not part of the project graph
  if (isExternalImport(source, aliases)) {
    return {
      raw: importInfo,
      resolvedPath: null,
      error: 'external_package',
    };
  }

  // Try alias resolution first
  if (!source.startsWith('.')) {
    const aliasResolved = resolveAlias(source, aliases, extensions);
    if (aliasResolved) {
      return { raw: importInfo, resolvedPath: path.resolve(aliasResolved) };
    }

    return {
      raw: importInfo,
      resolvedPath: null,
      error: `Could not resolve alias import: ${source}`,
    };
  }

  // Relative import resolution
  const importDir = path.dirname(importingFile);
  const absoluteTarget = path.resolve(importDir, source);
  const resolved = tryResolveFile(absoluteTarget, extensions);

  if (resolved) {
    return { raw: importInfo, resolvedPath: path.resolve(resolved) };
  }

  return {
    raw: importInfo,
    resolvedPath: null,
    error: `Could not resolve: ${source} (from ${importingFile})`,
  };
}

/**
 * Resolve all imports from a single file.
 *
 * Filters out external packages and returns only local (project-internal)
 * resolved imports.
 *
 * @param imports       - Raw imports extracted by parseImports()
 * @param importingFile - Absolute path of the file containing the imports
 * @param aliases       - Path alias mappings from tsconfig.json
 * @param extensions    - File extensions to try during resolution
 * @returns Array of resolved imports (only those with resolvedPath !== null)
 */
export function resolveImports(
  imports: RawImportInfo[],
  importingFile: string,
  aliases: AliasMapping[],
  extensions: string[] = DEFAULT_EXTENSIONS,
): ResolvedImport[] {
  return imports.map((imp) => resolveImport(imp, importingFile, aliases, extensions));
}
