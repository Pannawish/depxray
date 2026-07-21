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
  RawExportInfo,
  RawImportInfo,
  UnresolvedImport,
  DevDependencyInProd,
  ImportConventionViolation,
  RuleValidationResult,
  RuleViolation,
  ArchitectureRule,
} from './types.js';
import {
  DEFAULT_ENTRY_POINT_PATTERNS,
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORE_PATTERNS,
} from './types.js';
import { discoverFiles } from './fileDiscovery.js';
import { parseExports } from './parseExports.js';
import { parseImports } from './parseImports.js';
import { resolveImports } from './resolveImports.js';
import { buildGraph } from './buildGraph.js';
import { detectCircularDeps } from './detectCircularDeps.js';
import { detectOrphanFiles, matchesAnyPattern } from './detectOrphanFiles.js';
import { loadAliases } from './configLoader.js';
import { computeFileMetrics } from './computeMetrics.js';
import { detectUnusedDeps, normalizePackageName } from './detectUnusedDeps.js';
import { detectUnusedExports } from './detectUnusedExports.js';
import { detectProjectEntryPointPatterns } from './detectProjectEntryPoints.js';
import {
  createWorkspaceAliases,
  detectWorkspaces,
  getWorkspaceForPath,
} from './detectWorkspaces.js';
import { attachRuleViolations, validateRules } from './validateRules.js';
import { runAfterBuildGraphHooks, runAfterScanHooks } from './plugins.js';

const KNOWN_ASSET_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.webm',
  '.json',
]);

function isKnownAssetImport(specifier: string): boolean {
  const cleaned = specifier.split('?')[0]?.split('#')[0] ?? specifier;
  return KNOWN_ASSET_EXTENSIONS.has(path.extname(cleaned).toLowerCase());
}

function normalizeRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replaceAll('\\', '/');
}

function withoutKnownSourceExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|ts|jsx|js)$/i, '');
}

function normalizeImportSpecifier(specifier: string): string {
  return specifier.startsWith('.') ? specifier : specifier.replace(/\/$/, '');
}

function relativeImportSpecifier(fromFile: string, toFile: string): string {
  const relative = withoutKnownSourceExtension(
    path.relative(path.dirname(fromFile), toFile).replaceAll('\\', '/'),
  );
  return normalizeImportSpecifier(relative.startsWith('.') ? relative : `./${relative}`);
}

function absoluteAliasSpecifier(
  rootDir: string,
  targetFile: string,
  aliasPrefix = '@/',
  sourceRoot = 'src',
): string | null {
  const absoluteSourceRoot = path.resolve(rootDir, sourceRoot);
  const relative = path.relative(absoluteSourceRoot, targetFile).replaceAll('\\', '/');
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return normalizeImportSpecifier(`${aliasPrefix}${withoutKnownSourceExtension(relative)}`);
}

function buildForwardAdjacency(graph: { edges: Array<{ source: string; target: string }> }): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const current = adjacency.get(edge.source);
    if (current) {
      current.push(edge.target);
    } else {
      adjacency.set(edge.source, [edge.target]);
    }
  }
  return adjacency;
}

function findEntryPointNodes(
  graph: { nodes: Array<{ id: string; relativePath: string }> },
  patterns: string[] = [],
): Array<{ id: string; relativePath: string }> {
  return graph.nodes.filter((node) => matchesAnyPattern(node.relativePath, patterns));
}

function buildReachabilityFromEntries(
  graph: { edges: Array<{ source: string; target: string }> },
  entryPoints: Array<{ id: string; relativePath: string }>,
): Map<string, Set<string>> {
  const adjacency = buildForwardAdjacency(graph);
  const reachableByFile = new Map<string, Set<string>>();

  for (const entryPoint of entryPoints) {
    const visited = new Set<string>();
    const queue = [entryPoint.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const reachableFrom = reachableByFile.get(current);
      if (reachableFrom) {
        reachableFrom.add(entryPoint.relativePath);
      } else {
        reachableByFile.set(current, new Set([entryPoint.relativePath]));
      }

      for (const child of adjacency.get(current) ?? []) {
        queue.push(child);
      }
    }
  }

  return reachableByFile;
}

function detectImportConventionViolations(
  rootDir: string,
  edges: Array<{ source: string; target: string; importSpecifier: string }>,
  fileImportsMap: Map<string, ResolvedImport[]>,
  config: NonNullable<ScanOptions['importConventions']>,
): ImportConventionViolation[] {
  const prefer = config.prefer ?? 'absolute';
  const violations: ImportConventionViolation[] = [];

  for (const edge of edges) {
    const line = fileImportsMap.get(edge.source)
      ?.find((resolvedImport) => (
        resolvedImport.resolvedPath === edge.target &&
        resolvedImport.raw.source === edge.importSpecifier
      ))
      ?.raw.line ?? 0;
    const isRelative = edge.importSpecifier.startsWith('.');
    if (prefer === 'absolute' && isRelative) {
      const suggestedSpecifier = absoluteAliasSpecifier(
        rootDir,
        edge.target,
        config.aliasPrefix ?? '@/',
        config.root ?? 'src',
      );
      if (!suggestedSpecifier || suggestedSpecifier === edge.importSpecifier) {
        continue;
      }
      violations.push({
        file: normalizeRelativePath(rootDir, edge.source),
        target: normalizeRelativePath(rootDir, edge.target),
        importSpecifier: edge.importSpecifier,
        suggestedSpecifier,
        expected: 'absolute',
        line,
      });
    } else if (prefer === 'relative' && !isRelative) {
      const suggestedSpecifier = relativeImportSpecifier(edge.source, edge.target);
      if (suggestedSpecifier === edge.importSpecifier) {
        continue;
      }
      violations.push({
        file: normalizeRelativePath(rootDir, edge.source),
        target: normalizeRelativePath(rootDir, edge.target),
        importSpecifier: edge.importSpecifier,
        suggestedSpecifier,
        expected: 'relative',
        line,
      });
    }
  }

  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.importSpecifier.localeCompare(b.importSpecifier));
}

function detectDevDepsInProd(
  rootDir: string,
  graph: { nodes: Array<{ id: string; relativePath: string }>; edges: Array<{ source: string; target: string }> },
  fileImportsMap: Map<string, ResolvedImport[]>,
  packageJson: { devDependencies?: Record<string, string> },
  prodEntryPointPatterns: string[],
  devEntryPointPatterns: string[] = [],
  ignoreTypeImports = false,
): DevDependencyInProd[] {
  const devDependencies = new Set(Object.keys(packageJson.devDependencies ?? {}));
  if (devDependencies.size === 0 || prodEntryPointPatterns.length === 0) {
    return [];
  }

  const prodEntries = findEntryPointNodes(graph, prodEntryPointPatterns);
  const reachableByFile = buildReachabilityFromEntries(graph, prodEntries);
  const findings: DevDependencyInProd[] = [];
  const seen = new Set<string>();

  for (const [filePath, entryPoints] of reachableByFile) {
    const relativeFile = normalizeRelativePath(rootDir, filePath);
    if (devEntryPointPatterns.length > 0 && matchesAnyPattern(relativeFile, devEntryPointPatterns)) {
      continue;
    }

    for (const resolvedImport of fileImportsMap.get(filePath) ?? []) {
      if (resolvedImport.error !== 'external_package') {
        continue;
      }
      if (ignoreTypeImports && resolvedImport.raw.isTypeOnly) {
        continue;
      }

      const module = normalizePackageName(resolvedImport.raw.source);
      if (!module || !devDependencies.has(module)) {
        continue;
      }

      for (const entryPoint of entryPoints) {
        const key = `${relativeFile}:${resolvedImport.raw.line}:${module}:${entryPoint}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        findings.push({
          file: relativeFile,
          module,
          importSpecifier: resolvedImport.raw.source,
          line: resolvedImport.raw.line,
          entryPoint,
          isTypeOnly: resolvedImport.raw.isTypeOnly,
        });
      }
    }
  }

  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.module.localeCompare(b.module));
}

function scopedRuleMessage(rule: ArchitectureRule): string {
  return rule.message ?? 'Restricted import for entry point';
}

function detectScopedRestrictedImports(
  rootDir: string,
  graph: { nodes: Array<{ id: string; relativePath: string }>; edges: Array<{ source: string; target: string; importSpecifier: string }> },
  fileImportsMap: Map<string, ResolvedImport[]>,
  rules: ArchitectureRule[] = [],
): RuleViolation[] {
  const scopedRules = rules.filter((rule) => rule.entryPoints?.length && rule.deny);
  if (scopedRules.length === 0) {
    return [];
  }

  const violations: RuleViolation[] = [];
  const seen = new Set<string>();

  for (const rule of scopedRules) {
    const entryPoints = findEntryPointNodes(graph, rule.entryPoints ?? []);
    const reachableByFile = buildReachabilityFromEntries(graph, entryPoints);

    for (const edge of graph.edges) {
      const sourceEntryPoints = reachableByFile.get(edge.source);
      if (!sourceEntryPoints) {
        continue;
      }

      const source = normalizeRelativePath(rootDir, edge.source);
      const target = normalizeRelativePath(rootDir, edge.target);
      if (!matchesAnyPattern(target, rule.deny?.files ?? [])) {
        continue;
      }

      for (const entryPoint of sourceEntryPoints) {
        const key = `${entryPoint}:${source}:${target}:${edge.importSpecifier}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        violations.push({
          source,
          target,
          importSpecifier: edge.importSpecifier,
          from: rule.entryPoints?.join(', ') ?? '',
          to: (rule.deny?.files ?? []).join(', '),
          entryPoint,
          severity: rule.severity === 'warning' ? 'warning' : 'error',
          message: scopedRuleMessage(rule),
        });
      }
    }

    for (const [filePath, resolvedImports] of fileImportsMap.entries()) {
      const sourceEntryPoints = reachableByFile.get(filePath);
      if (!sourceEntryPoints) {
        continue;
      }

      const source = normalizeRelativePath(rootDir, filePath);
      for (const resolvedImport of resolvedImports) {
        if (resolvedImport.error !== 'external_package') {
          continue;
        }
        const module = normalizePackageName(resolvedImport.raw.source) ?? resolvedImport.raw.source;
        const deniedModules = rule.deny?.modules ?? [];
        if (!deniedModules.some((pattern) => pattern === module || pattern === resolvedImport.raw.source || matchesAnyPattern(module, [pattern]))) {
          continue;
        }

        for (const entryPoint of sourceEntryPoints) {
          const key = `${entryPoint}:${source}:${module}:${resolvedImport.raw.line}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          violations.push({
            source,
            target: module,
            importSpecifier: resolvedImport.raw.source,
            from: rule.entryPoints?.join(', ') ?? '',
            to: deniedModules.join(', '),
            entryPoint,
            severity: rule.severity === 'warning' ? 'warning' : 'error',
            message: scopedRuleMessage(rule),
          });
        }
      }
    }
  }

  return violations;
}

function mergeRuleValidation(
  validation: RuleValidationResult | undefined,
  extraViolations: RuleViolation[],
): RuleValidationResult | undefined {
  if (!validation && extraViolations.length === 0) {
    return undefined;
  }

  const violations = [...(validation?.violations ?? []), ...extraViolations];
  return {
    violations,
    errorCount: violations.filter((violation) => violation.severity === 'error').length,
    warningCount: violations.filter((violation) => violation.severity === 'warning').length,
  };
}

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
  const detectedEntryPointPatterns = entryPointPatterns === undefined
    ? await detectProjectEntryPointPatterns(resolvedRoot, workspaces)
    : [];
  const effectiveEntryPointPatterns = entryPointPatterns ?? [
    ...DEFAULT_ENTRY_POINT_PATTERNS,
    ...detectedEntryPointPatterns,
  ];

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
      unresolvedImports: [],
      ...(shouldDetectUnusedDeps ? { dependencyIssues: { unused: [], unlisted: [] } } : {}),
      ...(rules.length > 0 ? { ruleValidation: { violations: [], errorCount: 0, warningCount: 0 } } : {}),
      errors: [],
      durationMs: emptyMetadata.scanDurationMs,
    };
    return runAfterScanHooks(emptyResult, plugins, pluginContext);
  }

  // ── Step 3 & 4: Parse imports and resolve paths for each file ────────
  const fileImportsMap = new Map<string, ResolvedImport[]>();
  const fileExportsMap = new Map<string, RawExportInfo[]>();
  const fileMetricsMap = new Map<string, Omit<FileMetrics, 'instability'>>();
  const unresolvedImports: UnresolvedImport[] = [];
  const unresolvedImportsByFile = new Map<string, UnresolvedImport[]>();
  analysisCache?.retain(new Set(filePaths));

  // Process files concurrently for performance, but limit concurrency
  // to avoid opening too many file handles at once
  const BATCH_SIZE = 50;
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (filePath) => {
        try {
          const fileStat = await fs.stat(filePath);
          const signature = `${fileStat.mtimeMs}:${fileStat.ctimeMs}:${fileStat.size}`;
          const cachedAnalysis = analysisCache?.get(filePath, signature);
          let rawImports: RawImportInfo[];

          if (cachedAnalysis) {
            rawImports = cachedAnalysis.rawImports;
            fileMetricsMap.set(filePath, cachedAnalysis.metrics);
            fileExportsMap.set(filePath, cachedAnalysis.rawExports);
          } else {
            const sourceCode = await fs.readFile(filePath, 'utf-8');
            const metrics = computeFileMetrics(sourceCode, filePath);
            const rawExports = parseExports(sourceCode, filePath);
            rawImports = parseImports(sourceCode, filePath);
            fileMetricsMap.set(filePath, metrics);
            fileExportsMap.set(filePath, rawExports);
            analysisCache?.set(filePath, {
              signature,
              rawImports,
              rawExports,
              metrics,
            });
          }

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
          const fileUnresolvedImports = resolved
            .filter((resolvedImport) => (
              !resolvedImport.resolvedPath &&
              resolvedImport.error !== 'external_package' &&
              !isKnownAssetImport(resolvedImport.raw.source)
            ))
            .map<UnresolvedImport>((resolvedImport) => ({
              file: path.relative(resolvedRoot, filePath),
              absoluteFilePath: filePath,
              importSpecifier: resolvedImport.raw.source,
              line: resolvedImport.raw.line,
              isTypeOnly: resolvedImport.raw.isTypeOnly,
              isDynamic: resolvedImport.raw.isDynamic,
              ...(resolvedImport.error ? { error: resolvedImport.error } : {}),
            }));
          unresolvedImports.push(...fileUnresolvedImports);
          unresolvedImportsByFile.set(filePath, fileUnresolvedImports);
        } catch (err) {
          analysisCache?.delete(filePath);
          errors.push({
            filePath,
            error: (err as Error).message,
          });
          // Still add the file to the map so it appears as a node
          fileImportsMap.set(filePath, []);
          fileExportsMap.set(filePath, []);
          unresolvedImportsByFile.set(filePath, []);
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

  const baseRuleValidation = rules.length > 0
    ? validateRules(graph, rules)
    : undefined;

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

  let projectPackageJson: {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  } | undefined;
  if (shouldDetectUnusedDeps || prodEntryPoints.length > 0) {
    try {
      const packageJsonPath = path.join(resolvedRoot, 'package.json');
      projectPackageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as typeof projectPackageJson;
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
      const importReferences = [...fileImportsMap.values()]
        .flat()
        .map((resolved) => ({
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

  const devDepsInProd = projectPackageJson && prodEntryPoints.length > 0
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
    ? detectImportConventionViolations(
      resolvedRoot,
      graph.edges,
      fileImportsMap,
      importConventions,
    )
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
