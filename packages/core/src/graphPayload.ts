import * as path from 'node:path';
import { computeHealthScore } from './computeHealthScore.js';
import {
  GRAPH_PAYLOAD_SCHEMA_VERSION,
  type ExplorerGraphData,
  type ExplorerGraphEdge,
  type ExplorerGraphNode,
} from './graphContract.js';
import type { ScanResult, StructureGraph } from './types.js';

export interface GraphPayloadOptions {
  generatedBy: string;
  scannedAt?: string;
}

export function createStructureGraphPayload(
  graph: StructureGraph,
  options: GraphPayloadOptions,
): ExplorerGraphData {
  return {
    schemaVersion: GRAPH_PAYLOAD_SCHEMA_VERSION,
    mode: 'structure',
    projectRoot: graph.rootDir,
    scannedAt: options.scannedAt ?? new Date().toISOString(),
    totalFiles: graph.nodes.filter((node) => node.kind === 'file').length,
    totalDirs: graph.nodes.filter((node) => node.kind === 'directory').length,
    totalImports: 0,
    circularCount: 0,
    circularDependencies: [],
    orphanFiles: [],
    unresolvedImports: [],
    generatedBy: options.generatedBy,
    errors: [],
    nodes: graph.nodes,
    edges: graph.edges.map((edge) => ({ ...edge, kind: 'structure' })),
  };
}

export function createDependencyGraphPayload(
  result: ScanResult,
  options: GraphPayloadOptions,
): ExplorerGraphData {
  const orphanFileSet = new Set(result.orphanFiles);
  const nodes: ExplorerGraphNode[] = result.graph.nodes.map((node) => ({
    id: node.id,
    label: path.basename(node.relativePath),
    relativePath: node.relativePath,
    absolutePath: node.id,
    kind: 'file',
    extension: node.extension,
    depth: Math.max(1, node.relativePath.split(/[/\\]/).filter(Boolean).length),
    collapsed: false,
    hidden: false,
    childCount: node.outDegree,
    descendantCount: Math.max(node.inDegree, node.outDegree),
    inDegree: node.inDegree,
    outDegree: node.outDegree,
    isCircular: node.isCircular,
    isOrphan: orphanFileSet.has(node.relativePath),
    ...(node.workspace ? { workspace: node.workspace } : {}),
    ...(node.metrics ? { metrics: node.metrics } : {}),
    ...(node.componentName ? { componentName: node.componentName } : {}),
    ...(node.unusedExports ? { unusedExports: node.unusedExports } : {}),
    ...(node.unresolvedImports ? { unresolvedImports: node.unresolvedImports } : {}),
    ...(node.pluginData ? { pluginData: node.pluginData } : {}),
  }));
  const edges: ExplorerGraphEdge[] = result.graph.edges.map((edge, index) => ({
    id: `${edge.source}->${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    kind: 'dependencies',
    importSpecifier: edge.importSpecifier,
    importedNames: edge.importedNames,
    isTypeOnly: edge.isTypeOnly,
    isDynamic: edge.isDynamic,
    ...(edge.isCrossPackage ? { isCrossPackage: true } : {}),
    ...(edge.ruleViolations ? { ruleViolations: edge.ruleViolations } : {}),
    ...(edge.pluginData ? { pluginData: edge.pluginData } : {}),
  }));

  return {
    schemaVersion: GRAPH_PAYLOAD_SCHEMA_VERSION,
    mode: 'dependencies',
    projectRoot: result.graph.rootDir,
    scannedAt: options.scannedAt ?? result.graph.metadata.scannedAt,
    totalFiles: result.totalFiles,
    totalDirs: 0,
    totalImports: result.totalImports,
    circularCount: result.circularCount,
    circularDependencies: result.graph.circularDependencies,
    orphanFiles: result.orphanFiles,
    unresolvedImports: result.unresolvedImports,
    ...(result.dependencyIssues ? { dependencyIssues: result.dependencyIssues } : {}),
    ...(result.ruleValidation ? { ruleValidation: result.ruleValidation } : {}),
    ...(result.devDepsInProd ? { devDepsInProd: result.devDepsInProd } : {}),
    ...(result.importConventionViolations ? { importConventionViolations: result.importConventionViolations } : {}),
    healthScore: computeHealthScore(result),
    ...(result.pluginData ? { pluginData: result.pluginData } : {}),
    generatedBy: options.generatedBy,
    errors: result.errors,
    nodes,
    edges,
  };
}
