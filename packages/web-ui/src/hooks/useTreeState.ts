import { useState } from 'react';
import type { DepthFilter, StructureGraphData, StructureGraphNode } from '../types.js';

function isVisible(
  node: StructureGraphNode,
  parentById: Map<string, string>,
  collapsedIds: Set<string>,
  maxDepth: number,
): boolean {
  if (node.depth > maxDepth) {
    return false;
  }

  let currentParentId = parentById.get(node.id);
  while (currentParentId) {
    if (collapsedIds.has(currentParentId)) {
      return false;
    }
    currentParentId = parentById.get(currentParentId);
  }

  return true;
}

export function useTreeState(
  data: StructureGraphData | null,
  depthFilter: DepthFilter,
  searchTerm: string,
) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const maxDepth = depthFilter === 'all' ? Number.POSITIVE_INFINITY : depthFilter;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!data) {
    return {
      collapsedIds,
      visibleNodes: [],
      visibleEdges: [],
      matchedNodeIds: new Set<string>(),
      toggleCollapsed: (_nodeId: string) => undefined,
    };
  }

  const parentById = new Map<string, string>();
  for (const edge of data.edges) {
    parentById.set(edge.target, edge.source);
  }

  const visibleNodes = data.nodes
    .filter((node) => isVisible(node, parentById, collapsedIds, maxDepth))
    .map((node) => ({
      ...node,
      collapsed: collapsedIds.has(node.id),
      hidden: false,
    }));

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = data.edges.filter((edge) => (
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  ));

  const matchedNodeIds = normalizedSearch
    ? new Set(
      visibleNodes
        .filter((node) => (
          node.label.toLowerCase().includes(normalizedSearch) ||
          node.relativePath.toLowerCase().includes(normalizedSearch)
        ))
        .map((node) => node.id),
    )
    : visibleNodeIds;

  function toggleCollapsed(nodeId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  return {
    collapsedIds,
    visibleNodes,
    visibleEdges,
    matchedNodeIds,
    toggleCollapsed,
  };
}
