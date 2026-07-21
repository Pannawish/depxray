// ============================================================================
// exportGraph — Serialize a DependencyGraph to JSON
// ============================================================================

import type { DependencyGraph, UnresolvedImport } from './types.js';

/**
 * Serialize a DependencyGraph to a formatted JSON string.
 *
 * The output includes all nodes, edges, circular dependencies, and metadata.
 * This format is designed to be:
 * - Human-readable (indented JSON)
 * - Machine-parseable (for AI agents like Claude, Codex, Antigravity)
 * - Portable (uses relative paths for nodes/edges)
 *
 * @param graph - The dependency graph to serialize
 * @param pretty - Whether to format with indentation (default: true)
 * @returns JSON string representation of the graph
 */
export function exportGraphJSON(graph: DependencyGraph, pretty: boolean = true): string {
  const unresolvedImports: UnresolvedImport[] = graph.nodes.flatMap(
    (node) => node.unresolvedImports ?? [],
  );

  // Create a clean export object with relative paths for portability
  const exportData = {
    version: '1.0.0',
    metadata: graph.metadata,
    nodes: graph.nodes.map((node) => ({
      id: node.relativePath,
      relativePath: node.relativePath,
      extension: node.extension,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
      isCircular: node.isCircular,
      ...(node.workspace ? { workspace: node.workspace } : {}),
      ...(node.metrics ? { metrics: node.metrics } : {}),
      ...(node.componentName ? { componentName: node.componentName } : {}),
      ...(node.unusedExports ? { unusedExports: node.unusedExports } : {}),
      ...(node.unresolvedImports ? { unresolvedImports: node.unresolvedImports } : {}),
      ...(node.pluginData ? { pluginData: node.pluginData } : {}),
    })),
    edges: graph.edges.map((edge) => ({
      source: edge.source.includes(graph.rootDir)
        ? edge.source.replace(graph.rootDir + '/', '')
        : edge.source,
      target: edge.target.includes(graph.rootDir)
        ? edge.target.replace(graph.rootDir + '/', '')
        : edge.target,
      importSpecifier: edge.importSpecifier,
      importedNames: edge.importedNames,
      isTypeOnly: edge.isTypeOnly,
      isDynamic: edge.isDynamic,
      ...(edge.isCrossPackage ? { isCrossPackage: edge.isCrossPackage } : {}),
      ...(edge.ruleViolations ? { ruleViolations: edge.ruleViolations } : {}),
      ...(edge.pluginData ? { pluginData: edge.pluginData } : {}),
    })),
    circularDependencies: graph.circularDependencies,
    unresolvedImports,
    ...(graph.pluginData ? { pluginData: graph.pluginData } : {}),
  };

  return JSON.stringify(exportData, null, pretty ? 2 : undefined);
}
