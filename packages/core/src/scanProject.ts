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
//   7. Detect orphan files
//   8. Return the complete ScanResult
//
// This function is platform-agnostic — it works in Node.js without any
// dependency on CLI frameworks or browser APIs.
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import packageJson from '../package.json';
import type {
  ScanOptions,
  ScanResult,
  ScanError,
  ScanMetadata,
  ResolvedImport,
  FileMetrics,
} from './types.js';
import { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_PATTERNS } from './types.js';
import { discoverFiles } from './fileDiscovery.js';
import { parseImports } from './parseImports.js';
import { resolveImports } from './resolveImports.js';
import { buildGraph } from './buildGraph.js';
import { detectCircularDeps } from './detectCircularDeps.js';
import { detectOrphanFiles } from './detectOrphanFiles.js';
import { loadAliases } from './configLoader.js';
import { computeFileMetrics } from './computeMetrics.js';
import { detectUnusedDeps } from './detectUnusedDeps.js';
import {
  createWorkspaceAliases,
  detectWorkspaces,
  getWorkspaceForPath,
} from './detectWorkspaces.js';
import { attachRuleViolations, validateRules } from './validateRules.js';
import { runAfterBuildGraphHooks, runAfterScanHooks } from './plugins.js';

/**
 * Scan a React project and build its dependency graph.
 *
 * This is the main entry point for the `@depxray/core` package. It performs a
 * complete scan of the given project directory, parsing all React/TypeScript
 * files and building a graph of their import relationships.
 *
 * @param options - Configuration for the scan (rootDir is required)
 * @returns A complete ScanResult with the graph, statistics, and any errors
 *
 * @example
 * ```typescript
 * import { scanProject } from '@depxray/core';
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
    entryPointPatterns,
    detectUnusedDeps: shouldDetectUnusedDeps = false,
    rules = [],
    plugins = [],
  } = options;

  // Validate rootDir
  const resolvedRoot = path.resolve(rootDir);
  const pluginContext = { rootDir: resolvedRoot };
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
  const workspaces = await detectWorkspaces(resolvedRoot);
  const aliases = resolveAliases
    ? [...loadAliases(resolvedRoot), ...createWorkspaceAliases(workspaces)]
    : createWorkspaceAliases(workspaces);

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
      depxrayVersion: packageJson.version,
    };

    const emptyGraph = await runAfterBuildGraphHooks(
      {
        rootDir: resolvedRoot,
        nodes: [],
        edges: [],
        circularDependencies: [],
        metadata: emptyMetadata,
      },
      plugins,
      pluginContext,
    );
    const emptyResult: ScanResult = {
      graph: emptyGraph,
      totalFiles: 0,
      totalImports: 0,
      circularCount: 0,
      orphanFiles: [],
      ...(shouldDetectUnusedDeps ? { dependencyIssues: { unused: [], unlisted: [] } } : {}),
      ...(rules.length > 0 ? { ruleValidation: { violations: [], errorCount: 0, warningCount: 0 } } : {}),
      errors: [],
      durationMs: emptyMetadata.scanDurationMs,
    };
    return runAfterScanHooks(emptyResult, plugins, pluginContext);
  }

  // ── Step 3 & 4: Parse imports and resolve paths for each file ────────
  const fileImportsMap = new Map<string, ResolvedImport[]>();
  const fileMetricsMap = new Map<string, Omit<FileMetrics, 'instability'>>();

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

          fileMetricsMap.set(filePath, computeFileMetrics(sourceCode, filePath));

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
    depxrayVersion: packageJson.version,
  };

  let graph = buildGraph(fileImportsMap, resolvedRoot, metadata);
  const workspaceByNodeId = new Map<string, string>();

  graph = {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const workspace = getWorkspaceForPath(node.id, workspaces)?.name;
      if (workspace) {
        workspaceByNodeId.set(node.id, workspace);
      }

      const baseMetrics = fileMetricsMap.get(node.id);
      if (!baseMetrics) {
        return {
          ...node,
          ...(workspace ? { workspace } : {}),
        };
      }

      const totalDegree = node.inDegree + node.outDegree;
      return {
        ...node,
        ...(workspace ? { workspace } : {}),
        metrics: {
          ...baseMetrics,
          instability: totalDegree === 0 ? 0 : node.outDegree / totalDegree,
        },
      };
    }),
  };

  graph = {
    ...graph,
    edges: graph.edges.map((edge) => {
      const sourceWorkspace = workspaceByNodeId.get(edge.source);
      const targetWorkspace = workspaceByNodeId.get(edge.target);
      if (!sourceWorkspace || !targetWorkspace || sourceWorkspace === targetWorkspace) {
        return edge;
      }

      return {
        ...edge,
        isCrossPackage: true,
      };
    }),
  };

  graph = await runAfterBuildGraphHooks(graph, plugins, pluginContext);

  // Update metadata with actual edge count
  graph.metadata.totalEdges = graph.edges.length;

  // ── Step 6: Detect circular dependencies ─────────────────────────────
  if (detectCircular) {
    graph = detectCircularDeps(graph);
  }

  // ── Step 7: Detect orphan files ─────────────────────────────────────
  const orphanFiles = detectOrphanFiles(graph, { entryPointPatterns });

  const ruleValidation = rules.length > 0
    ? validateRules(graph, rules)
    : undefined;
  if (ruleValidation) {
    graph = attachRuleViolations(graph, ruleValidation);
  }

  let dependencyIssues: ScanResult['dependencyIssues'];
  if (shouldDetectUnusedDeps) {
    try {
      const packageJsonPath = path.join(resolvedRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      };
      const importReferences = [...fileImportsMap.values()]
        .flat()
        .map((resolved) => ({
          importSpecifier: resolved.raw.source,
        }));
      dependencyIssues = detectUnusedDeps(resolvedRoot, importReferences, packageJson);
    } catch (err) {
      dependencyIssues = { unused: [], unlisted: [] };
      errors.push({
        filePath: path.join(resolvedRoot, 'package.json'),
        error: `Failed to analyze package dependencies: ${(err as Error).message}`,
      });
    }
  }

  // ── Return the complete result ───────────────────────────────────────
  const finalDurationMs = performance.now() - startTime;
  graph.metadata.scanDurationMs = finalDurationMs;

  const result: ScanResult = {
    graph,
    totalFiles: graph.nodes.length,
    totalImports: graph.edges.length,
    circularCount: graph.circularDependencies.length,
    orphanFiles,
    ...(dependencyIssues ? { dependencyIssues } : {}),
    ...(ruleValidation ? { ruleValidation } : {}),
    errors,
    durationMs: finalDurationMs,
  };

  const pluginResult = await runAfterScanHooks(result, plugins, pluginContext);
  pluginResult.totalFiles = pluginResult.graph.nodes.length;
  pluginResult.totalImports = pluginResult.graph.edges.length;
  pluginResult.circularCount = pluginResult.graph.circularDependencies.length;
  pluginResult.graph.metadata.totalFiles = pluginResult.totalFiles;
  pluginResult.graph.metadata.totalEdges = pluginResult.totalImports;
  pluginResult.graph.metadata.circularCount = pluginResult.circularCount;
  return pluginResult;
}
