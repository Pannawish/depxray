import * as path from 'node:path';
import type { DependencyGraph, GraphNode } from './types.js';

export interface DependencyChainResult {
  connected: boolean;
  from: string;
  to: string;
  chains: string[][];
  shortestDistance: number;
}

function normalizeRelative(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveNode(graph: DependencyGraph, filePath: string): GraphNode {
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

function buildChains(
  current: string,
  start: string,
  predecessors: Map<string, string[]>,
): string[][] {
  if (current === start) {
    return [[start]];
  }

  const parents = predecessors.get(current) ?? [];
  return parents.flatMap((parent) => (
    buildChains(parent, start, predecessors).map((chain) => [...chain, current])
  ));
}

export function findDependencyChain(
  graph: DependencyGraph,
  fromPath: string,
  toPath: string,
): DependencyChainResult {
  const fromNode = resolveNode(graph, fromPath);
  const toNode = resolveNode(graph, toPath);
  if (fromNode.id === toNode.id) {
    return {
      connected: true,
      from: fromNode.relativePath,
      to: toNode.relativePath,
      chains: [[fromNode.relativePath]],
      shortestDistance: 0,
    };
  }

  const adjacency = new Map<string, string[]>();
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const current = adjacency.get(edge.source);
    if (current) {
      current.push(edge.target);
    } else {
      adjacency.set(edge.source, [edge.target]);
    }
  }

  for (const [source, targets] of adjacency) {
    adjacency.set(source, [...new Set(targets)].sort());
  }

  const distances = new Map<string, number>([[fromNode.id, 0]]);
  const predecessors = new Map<string, string[]>();
  const queue = [fromNode.id];
  let shortestDistance = -1;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDistance = distances.get(current) ?? 0;
    if (shortestDistance !== -1 && currentDistance >= shortestDistance) {
      continue;
    }

    for (const target of adjacency.get(current) ?? []) {
      const nextDistance = currentDistance + 1;
      const knownDistance = distances.get(target);
      if (knownDistance === undefined) {
        distances.set(target, nextDistance);
        predecessors.set(target, [current]);
        queue.push(target);
      } else if (knownDistance === nextDistance) {
        predecessors.set(target, [...(predecessors.get(target) ?? []), current]);
      }

      if (target === toNode.id) {
        shortestDistance = nextDistance;
      }
    }
  }

  if (shortestDistance === -1) {
    return {
      connected: false,
      from: fromNode.relativePath,
      to: toNode.relativePath,
      chains: [],
      shortestDistance: -1,
    };
  }

  const chains = buildChains(toNode.id, fromNode.id, predecessors)
    .map((chain) => chain
      .map((nodeId) => nodesById.get(nodeId)?.relativePath ?? path.relative(graph.rootDir, nodeId).replaceAll('\\', '/')));

  return {
    connected: true,
    from: fromNode.relativePath,
    to: toNode.relativePath,
    chains,
    shortestDistance,
  };
}
