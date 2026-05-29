// ============================================================================
// scanProject — Main entry point for the dependency graph scanner
// ============================================================================
// This is the primary API for the core package. It orchestrates the full
// scanning pipeline:
//
//   1. Load config (tsconfig aliases)
//   2. Discover files
//   3. Parse imports from each file
//   4. Resolve import paths
//   5. Build the dependency graph
//   6. Detect circular dependencies (optional)
//   7. Return the complete ScanResult
//
// This function is platform-agnostic — it works in Node.js without any
// dependency on VS Code, CLI frameworks, or browser APIs.
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ScanOptions,
  ScanResult,
  ScanError,
  ScanMetadata,
  ResolvedImport,
} from './types.js';
import { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_PATTERNS } from './types.js';
import { discoverFiles } from './fileDiscovery.js';
import { parseImports } from './parseImports.js';
import { resolveImports } from './resolveImports.js';
import { buildGraph } from './buildGraph.js';
import { detectCircularDeps } from './detectCircularDeps.js';
import { loadAliases } from './configLoader.js';

// Read version from package.json at build time
const RDG_VERSION = '0.1.0';

/**
 * Scan a React project and build its dependency graph.
 *
 * This is the main entry point for the `@rdg/core` package. It performs a
 * complete scan of the given project directory, parsing all React/TypeScript
 * files and building a graph of their import relationships.
 *
 * @param options - Configuration for the scan (rootDir is required)
 * @returns A complete ScanResult with the graph, statistics, and any errors
 *
 * @example
 * ```typescript
 * import { scanProject } from '@rdg/core';
 *
 * const result = await scanProject({
 *   rootDir: '/path/to/my-react-app',
 *   detectCircular: true,
 * });
 *
 * console.log(`Scanned ${result.totalFiles} files`);
 * console.log(`Found ${result.totalImports} imports`);
 * console.log(`Circular dependencies: ${result.circularCount}`);
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * const result = await scanProject({
 *   rootDir: '/path/to/project',
 *   extensions: ['.ts', '.tsx'],          // Only TypeScript files
 *   ignorePatterns: ['__tests__', 'e2e'], // Skip test directories
 *   detectCircular: true,
 *   resolveAliases: true,
 * });
 * ```
 */
export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const startTime = performance.now();
  const errors: ScanError[] = [];

  // ── Merge options with defaults ──────────────────────────────────────
  const {
    rootDir,
    extensions = DEFAULT_EXTENSIONS,
    ignorePatterns: userIgnorePatterns = [],
    detectCircular = true,
    resolveAliases = true,
    maxDepth = Infinity,
    includeTypeImports = true,
    includeDynamicImports = true,
  } = options;

  // Validate rootDir
  const resolvedRoot = path.resolve(rootDir);
  try {
    const stat = await fs.stat(resolvedRoot);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${resolvedRoot}`);
    }
  } catch (err) {
    throw new Error(
      `Cannot access project root: ${resolvedRoot} — ${(err as Error).message}`,
    );
  }

  // Merge ignore patterns (user patterns + defaults)
  const ignorePatterns = [
    ...DEFAULT_IGNORE_PATTERNS,
    ...userIgnorePatterns,
  ];

  // ── Step 1: Load aliases from tsconfig.json ──────────────────────────
  const aliases = resolveAliases ? loadAliases(resolvedRoot) : [];

  // ── Step 2: Discover all scannable files ─────────────────────────────
  const filePaths = await discoverFiles(
    resolvedRoot,
    extensions,
    ignorePatterns,
    maxDepth,
  );

  if (filePaths.length === 0) {
    // No files found — return an empty result instead of crashing
    const emptyMetadata: ScanMetadata = {
      scannedAt: new Date().toISOString(),
      scanDurationMs: performance.now() - startTime,
      projectRoot: resolvedRoot,
      totalFiles: 0,
      totalEdges: 0,
      circularCount: 0,
      rdgVersion: RDG_VERSION,
    };

    return {
      graph: {
        rootDir: resolvedRoot,
        nodes: [],
        edges: [],
        circularDependencies: [],
        metadata: emptyMetadata,
      },
      totalFiles: 0,
      totalImports: 0,
      circularCount: 0,
      errors: [],
      durationMs: emptyMetadata.scanDurationMs,
    };
  }

  // ── Step 3 & 4: Parse imports and resolve paths for each file ────────
  const fileImportsMap = new Map<string, ResolvedImport[]>();

  // Process files concurrently for performance, but limit concurrency
  // to avoid opening too many file handles at once
  const BATCH_SIZE = 50;
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (filePath) => {
        try {
          // Read the file content
          const sourceCode = await fs.readFile(filePath, 'utf-8');

          // Parse imports from the AST
          let rawImports = parseImports(sourceCode, filePath);

          // Filter based on options
          if (!includeTypeImports) {
            rawImports = rawImports.filter((imp) => !imp.isTypeOnly);
          }
          if (!includeDynamicImports) {
            rawImports = rawImports.filter((imp) => !imp.isDynamic);
          }

          // Resolve import paths to absolute file paths
          const resolved = resolveImports(
            rawImports,
            filePath,
            aliases,
            extensions,
          );

          fileImportsMap.set(filePath, resolved);
        } catch (err) {
          errors.push({
            filePath,
            error: (err as Error).message,
          });
          // Still add the file to the map so it appears as a node
          fileImportsMap.set(filePath, []);
        }
      }),
    );
  }

  // ── Step 5: Build the dependency graph ───────────────────────────────
  const durationMs = performance.now() - startTime;

  const metadata: ScanMetadata = {
    scannedAt: new Date().toISOString(),
    scanDurationMs: durationMs,
    projectRoot: resolvedRoot,
    totalFiles: filePaths.length,
    totalEdges: 0, // Will be updated after buildGraph
    circularCount: 0, // Will be updated after detectCircularDeps
    rdgVersion: RDG_VERSION,
  };

  let graph = buildGraph(fileImportsMap, resolvedRoot, metadata);

  // Update metadata with actual edge count
  graph.metadata.totalEdges = graph.edges.length;

  // ── Step 6: Detect circular dependencies ─────────────────────────────
  if (detectCircular) {
    graph = detectCircularDeps(graph);
  }

  // ── Return the complete result ───────────────────────────────────────
  const finalDurationMs = performance.now() - startTime;
  graph.metadata.scanDurationMs = finalDurationMs;

  return {
    graph,
    totalFiles: graph.nodes.length,
    totalImports: graph.edges.length,
    circularCount: graph.circularDependencies.length,
    errors,
    durationMs: finalDurationMs,
  };
}
