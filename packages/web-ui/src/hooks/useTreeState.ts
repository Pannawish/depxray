import { useEffect, useState } from 'react';
import type { DepthFilter, StructureGraphData, StructureGraphNode } from '../types.js';

function buildDefaultCollapsedIds(data: StructureGraphData | null): Set<string> {
  if (!data) {
    return new Set();
  }

  return new Set(
    data.nodes
      .filter((node) => node.kind === 'directory' && node.childCount > 0 && node.depth >= 2)
      .map((node) => node.id),
  );
}

function collectAncestorIds(
  nodeId: string,
  parentById: Map<string, string>,
): string[] {
  const ancestors: string[] = [];
  let currentParentId = parentById.get(nodeId);

  while (currentParentId) {
    ancestors.push(currentParentId);
    currentParentId = parentById.get(currentParentId);
  }

  return ancestors;
}

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

  useEffect(() => {
    setCollapsedIds(buildDefaultCollapsedIds(data));
  }, [data]);

  if (!data) {
    return {
      collapsedIds,
      visibleNodes: [],
      visibleEdges: [],
      matchedNodeIds: new Set<string>(),
      emphasizedNodeIds: new Set<string>(),
      searchMatchCount: 0,
      collapsedCount: 0,
      firstMatchedVisibleNodeId: null,
      toggleCollapsed: (_nodeId: string) => undefined,
      expandAll: () => undefined,
      collapseAll: () => undefined,
      resetCollapsed: () => undefined,
    };
  }

  const parentById = new Map<string, string>();
  for (const edge of data.edges) {
    parentById.set(edge.target, edge.source);
  }

  const matchedNodeIds = normalizedSearch
    ? new Set(
      data.nodes
        .filter((node) => (
          node.label.toLowerCase().includes(normalizedSearch) ||
          node.relativePath.toLowerCase().includes(normalizedSearch)
        ))
        .map((node) => node.id),
    )
    : new Set<string>();

  const emphasizedNodeIds = new Set<string>(matchedNodeIds);
  for (const nodeId of matchedNodeIds) {
    for (const ancestorId of collectAncestorIds(nodeId, parentById)) {
      emphasizedNodeIds.add(ancestorId);
    }
  }

  const visibleNodes = data.nodes
    .filter((node) => (
      isVisible(node, parentById, collapsedIds, maxDepth) ||
      emphasizedNodeIds.has(node.id)
    ))
    .map((node) => ({
      ...node,
      collapsed: collapsedIds.has(node.id),
      hidden: false,
    }));

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = data.edges.filter((edge) => (
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  ));

  const visibleMatchedNodeIds = normalizedSearch
    ? new Set(
      visibleNodes
        .filter((node) => matchedNodeIds.has(node.id))
        .map((node) => node.id),
    )
    : visibleNodeIds;

  const firstMatchedVisibleNodeId = visibleNodes.find((node) => (
    visibleMatchedNodeIds.has(node.id)
  ))?.id ?? null;

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

  function expandAll() {
    setCollapsedIds(new Set());
  }

  function collapseAll() {
    setCollapsedIds(new Set(
      data.nodes
        .filter((node) => node.kind === 'directory' && node.childCount > 0 && node.depth > 0)
        .map((node) => node.id),
    ));
  }

  function resetCollapsed() {
    setCollapsedIds(buildDefaultCollapsedIds(data));
  }

  return {
    collapsedIds,
    visibleNodes,
    visibleEdges,
    matchedNodeIds: visibleMatchedNodeIds,
    emphasizedNodeIds,
    searchMatchCount: matchedNodeIds.size,
    collapsedCount: collapsedIds.size,
    firstMatchedVisibleNodeId,
    toggleCollapsed,
    expandAll,
    collapseAll,
    resetCollapsed,
  };
}
