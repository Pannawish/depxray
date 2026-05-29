// ============================================================================
// buildGraph — Construct the dependency graph from resolved imports
// ============================================================================
// Takes a map of files → resolved imports and builds the graph data structure
// (nodes + edges). Calculates in/out degrees for each node.
// ============================================================================

import * as path from 'path';
import type {
  GraphNode,
  GraphEdge,
  ResolvedImport,
  DependencyGraph,
  ScanMetadata,
} from './types.js';

/**
 * Build a dependency graph from the resolved import data.
 *
 * @param fileImportsMap - Map from absolute file path → array of resolved imports
 * @param rootDir        - Project root (for computing relative paths)
 * @param metadata       - Scan metadata to include in the graph
 * @returns A complete DependencyGraph (without circular dependency analysis)
 */
export function buildGraph(
  fileImportsMap: Map<string, ResolvedImport[]>,
  rootDir: string,
  metadata: ScanMetadata,
): DependencyGraph {
  // ── Build edges ──────────────────────────────────────────────────────
  const edges: GraphEdge[] = [];
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();

  // Initialize degree counts for all known files
  for (const filePath of fileImportsMap.keys()) {
    inDegreeMap.set(filePath, 0);
    outDegreeMap.set(filePath, 0);
  }

  for (const [sourceFile, resolvedImports] of fileImportsMap.entries()) {
    for (const resolved of resolvedImports) {
      // Skip unresolved imports (external packages, broken paths)
      if (!resolved.resolvedPath) {
        continue;
      }

      const targetFile = resolved.resolvedPath;

      // Ensure target is in the degree maps (it might be an internal file
      // that wasn't in our initial file list but is imported)
      if (!inDegreeMap.has(targetFile)) {
        inDegreeMap.set(targetFile, 0);
      }

      edges.push({
        source: sourceFile,
        target: targetFile,
        importSpecifier: resolved.raw.source,
        importedNames: resolved.raw.specifiers,
        isTypeOnly: resolved.raw.isTypeOnly,
        isDynamic: resolved.raw.isDynamic,
      });

      // Update degree counts
      outDegreeMap.set(sourceFile, (outDegreeMap.get(sourceFile) || 0) + 1);
      inDegreeMap.set(targetFile, (inDegreeMap.get(targetFile) || 0) + 1);
    }
  }

  // ── Build nodes ──────────────────────────────────────────────────────
  // Collect all unique file paths (from both source files and import targets)
  const allFiles = new Set<string>([
    ...fileImportsMap.keys(),
    ...edges.map((e) => e.target),
  ]);

  const nodes: GraphNode[] = Array.from(allFiles).map((filePath) => ({
    id: filePath,
    relativePath: path.relative(rootDir, filePath),
    extension: path.extname(filePath),
    inDegree: inDegreeMap.get(filePath) || 0,
    outDegree: outDegreeMap.get(filePath) || 0,
    isCircular: false, // Will be set by detectCircularDeps
  }));

  // Sort nodes by relative path for consistent output
  nodes.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    rootDir,
    nodes,
    edges,
    circularDependencies: [], // Populated later by detectCircularDeps
    metadata,
  };
}
