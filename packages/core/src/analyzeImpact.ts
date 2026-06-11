import * as path from 'node:path';
import type {
  DependencyGraph,
  GraphEdge,
  GraphNode,
  ImpactAnalysisOptions,
  ImpactAnalysisResult,
  ImpactFileSummary,
  ImpactRiskLevel,
} from './types.js';

const DEFAULT_COMPLEXITY_THRESHOLD = 10;
const DEFAULT_IMPACT_THRESHOLD = 10;
const DEFAULT_INBOUND_THRESHOLD = 5;

function normalizeRelative(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveTargetNode(graph: DependencyGraph, filePath: string): GraphNode {
  const normalizedInput = normalizeRelative(filePath);
  const absoluteInput = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(graph.rootDir, filePath);

  const node = graph.nodes.find((item) => (
    item.id === absoluteInput ||
    path.resolve(graph.rootDir, item.relativePath) === absoluteInput ||
    normalizeRelative(item.relativePath) === normalizedInput
  ));

  if (!node) {
    throw new Error(`File not found in dependency graph: ${filePath}`);
  }

  return node;
}

function reverseAdjacency(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const map = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const current = map.get(edge.target);
    if (current) {
      current.push(edge);
    } else {
      map.set(edge.target, [edge]);
    }
  }
  return map;
}

function complexityOf(node: GraphNode): number {
  return node.metrics?.cyclomaticComplexity ?? 0;
}

function getRiskFactors(
  node: GraphNode,
  distance: number,
  affectedCount: number,
  thresholds: Required<ImpactAnalysisOptions>,
): string[] {
  const factors: string[] = [];
  const complexity = complexityOf(node);
  const isTarget = distance === 0;

  if (isTarget && affectedCount >= thresholds.impactThreshold) {
    factors.push(`${affectedCount} transitive dependents`);
  }

  if (!isTarget && node.inDegree >= thresholds.inboundThreshold) {
    factors.push(`${node.inDegree} incoming imports`);
  }

  if (complexity >= thresholds.complexityThreshold) {
    factors.push(`complexity ${complexity}`);
  }

  if (node.isCircular) {
    factors.push('circular dependency');
  }

  return factors;
}

function fileRisk(factors: string[]): ImpactRiskLevel {
  const hasComplexity = factors.some((factor) => factor.startsWith('complexity '));
  const hasImpact = factors.some((factor) => (
    factor.endsWith('transitive dependents') ||
    factor.endsWith('incoming imports')
  ));

  if ((hasComplexity && hasImpact) || factors.includes('circular dependency')) {
    return 'high';
  }

  if (factors.length > 0) {
    return 'medium';
  }

  return 'low';
}

function toSummary(
  node: GraphNode,
  distance: number,
  pathIds: string[],
  nodesById: Map<string, GraphNode>,
  affectedCount: number,
  thresholds: Required<ImpactAnalysisOptions>,
): ImpactFileSummary {
  const factors = getRiskFactors(node, distance, affectedCount, thresholds);

  return {
    file: node.relativePath,
    absolutePath: node.id,
    distance,
    path: pathIds
      .map((pathId) => nodesById.get(pathId)?.relativePath)
      .filter((file): file is string => Boolean(file)),
    inDegree: node.inDegree,
    outDegree: node.outDegree,
    metrics: node.metrics,
    riskFactors: factors,
    risk: fileRisk(factors),
  };
}

function overallRisk(
  target: ImpactFileSummary,
  affectedCount: number,
  directDependentCount: number,
  highImpactComplexCount: number,
): ImpactRiskLevel {
  if (target.risk === 'high' || highImpactComplexCount > 0 || affectedCount >= 20) {
    return 'high';
  }

  if (target.risk === 'medium' || affectedCount >= 5 || directDependentCount >= 3) {
    return 'medium';
  }

  return 'low';
}

export function analyzeImpact(
  graph: DependencyGraph,
  filePath: string,
  options: ImpactAnalysisOptions = {},
): ImpactAnalysisResult {
  const thresholds: Required<ImpactAnalysisOptions> = {
    complexityThreshold: options.complexityThreshold ?? DEFAULT_COMPLEXITY_THRESHOLD,
    impactThreshold: options.impactThreshold ?? DEFAULT_IMPACT_THRESHOLD,
    inboundThreshold: options.inboundThreshold ?? DEFAULT_INBOUND_THRESHOLD,
  };
  const targetNode = resolveTargetNode(graph, filePath);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const reverse = reverseAdjacency(graph.edges);
  const visited = new Set<string>([targetNode.id]);
  const queue: Array<{ nodeId: string; distance: number; pathIds: string[] }> = [
    { nodeId: targetNode.id, distance: 0, pathIds: [targetNode.id] },
  ];
  const affected: Array<{ node: GraphNode; distance: number; pathIds: string[] }> = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const edge of reverse.get(current.nodeId) ?? []) {
      if (visited.has(edge.source)) {
        continue;
      }

      const sourceNode = nodesById.get(edge.source);
      if (!sourceNode) {
        continue;
      }

      const next = {
        node: sourceNode,
        distance: current.distance + 1,
        pathIds: [sourceNode.id, ...current.pathIds],
      };
      visited.add(sourceNode.id);
      affected.push(next);
      queue.push({
        nodeId: sourceNode.id,
        distance: next.distance,
        pathIds: next.pathIds,
      });
    }
  }

  const affectedCount = affected.length;
  const target = toSummary(
    targetNode,
    0,
    [targetNode.id],
    nodesById,
    affectedCount,
    thresholds,
  );
  const affectedFiles = affected
    .map((item) => toSummary(
      item.node,
      item.distance,
      item.pathIds,
      nodesById,
      affectedCount,
      thresholds,
    ))
    .sort((a, b) => a.distance - b.distance || a.file.localeCompare(b.file));
  const directDependents = affectedFiles.filter((item) => item.distance === 1);
  const candidates = [target, ...affectedFiles];
  const highImpactComplexFiles = candidates.filter((item) => {
    const complexity = item.metrics?.cyclomaticComplexity ?? 0;
    const isHighImpact = item.distance === 0
      ? affectedCount >= thresholds.impactThreshold
      : item.inDegree >= thresholds.inboundThreshold;

    return isHighImpact && complexity >= thresholds.complexityThreshold;
  });

  return {
    target,
    directDependents,
    affectedFiles,
    directDependentCount: directDependents.length,
    affectedCount,
    maxDistance: affectedFiles.reduce((max, item) => Math.max(max, item.distance), 0),
    highImpactComplexFiles,
    risk: overallRisk(target, affectedCount, directDependents.length, highImpactComplexFiles.length),
    thresholds,
  };
}
