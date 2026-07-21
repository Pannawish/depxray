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
import type { ScanOptions, ScanResult, ScanError, ScanMetadata } from './types.js';
import {
  DEFAULT_ENTRY_POINT_PATTERNS,
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORE_PATTERNS,
} from './types.js';
import { discoverFiles } from './fileDiscovery.js';
import { buildGraph } from './buildGraph.js';
import { detectCircularDeps } from './detectCircularDeps.js';
import { detectOrphanFiles, matchesAnyPattern } from './detectOrphanFiles.js';
import { loadAliases } from './configLoader.js';
import { detectUnusedDeps } from './detectUnusedDeps.js';
import { detectUnusedExports } from './detectUnusedExports.js';
import { detectProjectEntryPointPatterns } from './detectProjectEntryPoints.js';
import {
  createWorkspaceAliases,
  detectWorkspaces,
  getWorkspaceForPath,
} from './detectWorkspaces.js';
import { attachRuleViolations, validateRules } from './validateRules.js';
import { runAfterBuildGraphHooks, runAfterScanHooks } from './plugins.js';
import { analyzeProjectFiles } from './scanFileAnalysis.js';
import {
  detectDevDepsInProd,
  detectImportConventionViolations,
  detectScopedRestrictedImports,
  mergeRuleValidation,
} from './scanDiagnostics.js';

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
    prodEntryPoints = [],
    devEntryPoints = [],
    ignoreTypeImports = false,
    importConventions,
    plugins = [],
    analysisCache,
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
    throw new Error(`Cannot access project root: ${resolvedRoot} — ${(err as Error).message}`);
  }

  // Merge ignore patterns (user patterns + defaults)
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...userIgnorePatterns];

  // ── Step 1: Load aliases from tsconfig.json ──────────────────────────
  const workspaces = await detectWorkspaces(resolvedRoot);
  const aliases = resolveAliases
    ? [...loadAliases(resolvedRoot), ...createWorkspaceAliases(workspaces)]
    : createWorkspaceAliases(workspaces);
  const detectedEntryPointPatterns =
    entryPointPatterns === undefined
      ? await detectProjectEntryPointPatterns(resolvedRoot, workspaces)
      : [];
  const effectiveEntryPointPatterns = entryPointPatterns ?? [
    ...DEFAULT_ENTRY_POINT_PATTERNS,
    ...detectedEntryPointPatterns,
  ];

  // ── Step 2: Discover all scannable files ─────────────────────────────
  const filePaths = await discoverFiles(resolvedRoot, extensions, ignorePatterns, maxDepth);

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
      unresolvedImports: [],
      ...(shouldDetectUnusedDeps ? { dependencyIssues: { unused: [], unlisted: [] } } : {}),
      ...(rules.length > 0
        ? { ruleValidation: { violations: [], errorCount: 0, warningCount: 0 } }
        : {}),
      errors: [],
      durationMs: emptyMetadata.scanDurationMs,
    };
    return runAfterScanHooks(emptyResult, plugins, pluginContext);
  }

  // ── Step 3 & 4: Parse imports and resolve paths for each file ────────
  const fileAnalysis = await analyzeProjectFiles({
    rootDir: resolvedRoot,
    filePaths,
    aliases,
    extensions,
    includeTypeImports,
    includeDynamicImports,
    ...(analysisCache ? { analysisCache } : {}),
  });
  const {
    fileImportsMap,
    fileExportsMap,
    fileMetricsMap,
    unresolvedImports,
    unresolvedImportsByFile,
  } = fileAnalysis;
  errors.push(...fileAnalysis.errors);

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
  const orphanFiles = detectOrphanFiles(graph, { entryPointPatterns: effectiveEntryPointPatterns });
  const entryPointFiles = new Set(
    graph.nodes
      .filter((node) => matchesAnyPattern(node.relativePath, effectiveEntryPointPatterns))
      .map((node) => node.id),
  );
  const unusedExportsByFile = detectUnusedExports(fileImportsMap, fileExportsMap, {
    entryPointFiles,
  });

  graph = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ...(unusedExportsByFile.get(node.id)?.length
        ? { unusedExports: unusedExportsByFile.get(node.id) }
        : {}),
      ...(unresolvedImportsByFile.get(node.id)?.length
        ? { unresolvedImports: unresolvedImportsByFile.get(node.id) }
        : {}),
    })),
  };

  const baseRuleValidation = rules.length > 0 ? validateRules(graph, rules) : undefined;

  const scopedRuleViolations = detectScopedRestrictedImports(
    resolvedRoot,
    graph,
    fileImportsMap,
    rules,
  );
  const ruleValidation = mergeRuleValidation(baseRuleValidation, scopedRuleViolations);
  if (ruleValidation) {
    graph = attachRuleViolations(graph, ruleValidation);
  }

  let projectPackageJson:
    | {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      }
    | undefined;
  if (shouldDetectUnusedDeps || prodEntryPoints.length > 0) {
    try {
      const packageJsonPath = path.join(resolvedRoot, 'package.json');
      projectPackageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8'),
      ) as typeof projectPackageJson;
    } catch (err) {
      errors.push({
        filePath: path.join(resolvedRoot, 'package.json'),
        error: `Failed to read package dependencies: ${(err as Error).message}`,
      });
    }
  }

  let dependencyIssues: ScanResult['dependencyIssues'];
  if (shouldDetectUnusedDeps && projectPackageJson) {
    try {
      const importReferences = [...fileImportsMap.values()].flat().map((resolved) => ({
        importSpecifier: resolved.raw.source,
      }));
      dependencyIssues = detectUnusedDeps(resolvedRoot, importReferences, projectPackageJson);
    } catch (err) {
      dependencyIssues = { unused: [], unlisted: [] };
      errors.push({
        filePath: path.join(resolvedRoot, 'package.json'),
        error: `Failed to analyze package dependencies: ${(err as Error).message}`,
      });
    }
  }

  const devDepsInProd =
    projectPackageJson && prodEntryPoints.length > 0
      ? detectDevDepsInProd(
          resolvedRoot,
          graph,
          fileImportsMap,
          projectPackageJson,
          prodEntryPoints,
          devEntryPoints,
          ignoreTypeImports,
        )
      : undefined;

  const importConventionViolations = importConventions
    ? detectImportConventionViolations(resolvedRoot, graph.edges, fileImportsMap, importConventions)
    : undefined;

  // ── Return the complete result ───────────────────────────────────────
  const finalDurationMs = performance.now() - startTime;
  graph.metadata.scanDurationMs = finalDurationMs;

  const result: ScanResult = {
    graph,
    totalFiles: graph.nodes.length,
    totalImports: graph.edges.length,
    circularCount: graph.circularDependencies.length,
    orphanFiles,
    unresolvedImports,
    ...(dependencyIssues ? { dependencyIssues } : {}),
    ...(ruleValidation ? { ruleValidation } : {}),
    ...(devDepsInProd ? { devDepsInProd } : {}),
    ...(importConventionViolations ? { importConventionViolations } : {}),
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
