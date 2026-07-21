// ============================================================================
// detectCircularDeps — Find circular dependency chains in the graph
// ============================================================================
// Uses DFS (Depth-First Search) with node coloring to detect cycles.
//
// Algorithm:
//   WHITE (0) = unvisited
//   GRAY  (1) = currently in the DFS stack (being explored)
//   BLACK (2) = fully explored (all descendants visited)
//
// A cycle is found when we encounter a GRAY node during DFS traversal,
// meaning we've reached a node that's still being explored — a back edge.
// ============================================================================

import * as path from 'path';
import type { DependencyGraph, CircularChain } from './types.js';

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

/**
 * Detect all circular dependency chains in a dependency graph.
 *
 * Modifies the graph in-place:
 * - Sets `isCircular = true` on nodes that participate in cycles
 * - Populates `circularDependencies` with all detected chains
 *
 * @param graph - The dependency graph to analyze (modified in-place)
 * @returns The same graph reference, with circular dependency data populated
 *
 * @example
 * ```typescript
 * const graph = buildGraph(fileImportsMap, rootDir, metadata);
 * detectCircularDeps(graph);
 * console.log(graph.circularDependencies);
 * // [{ chain: ['A.tsx', 'B.tsx', 'A.tsx'], description: 'A.tsx → B.tsx → A.tsx' }]
 * ```
 */
export function detectCircularDeps(graph: DependencyGraph): DependencyGraph {
  const { nodes, edges, rootDir } = graph;

  // Build adjacency list for fast traversal
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (targets) {
      targets.push(edge.target);
    }
  }

  // Track node state for DFS
  const color = new Map<string, number>();
  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  // Track the current DFS path for cycle extraction
  const currentPath: string[] = [];
  const cycles: CircularChain[] = [];
  const circularNodeIds = new Set<string>();

  /**
   * DFS visit function. Returns true if a cycle was found downstream.
   */
  function dfs(nodeId: string): void {
    color.set(nodeId, GRAY);
    currentPath.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];

    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor);

      if (neighborColor === GRAY) {
        // Found a cycle! Extract the chain from the current path.
        const cycleStart = currentPath.indexOf(neighbor);
        if (cycleStart !== -1) {
          const chain = [
            ...currentPath.slice(cycleStart),
            neighbor, // Complete the cycle
          ];

          // Convert to relative paths for readability
          const relativeChain = chain.map((p) => path.relative(rootDir, p));
          const description = relativeChain.join(' → ');

          // Avoid duplicate cycle reports (same cycle can be found from
          // different starting nodes)
          const key = [...relativeChain].slice(0, -1).sort().join('|');
          const isDuplicate = cycles.some((c) => {
            const existingKey = [...c.chain].slice(0, -1).sort().join('|');
            return existingKey === key;
          });

          if (!isDuplicate) {
            cycles.push({ chain: relativeChain, description });

            // Mark all nodes in this cycle as circular
            for (const nodeInCycle of chain) {
              circularNodeIds.add(nodeInCycle);
            }
          }
        }
      } else if (neighborColor === WHITE) {
        dfs(neighbor);
      }
      // BLACK nodes are already fully explored — skip them
    }

    currentPath.pop();
    color.set(nodeId, BLACK);
  }

  // Run DFS from every unvisited node
  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      dfs(node.id);
    }
  }

  // Update the graph with results
  graph.circularDependencies = cycles;
  graph.metadata.circularCount = cycles.length;

  // Mark circular nodes
  for (const node of graph.nodes) {
    node.isCircular = circularNodeIds.has(node.id);
  }

  return graph;
}
