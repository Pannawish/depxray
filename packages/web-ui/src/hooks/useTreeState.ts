import { useEffect, useState } from 'react';
import type {
  DependencyFilters,
  DepthFilter,
  ExplorerGraphData,
  ExplorerGraphEdge,
  ExplorerGraphNode,
  GraphMode,
} from '../types.js';

function buildDefaultCollapsedIds(data: ExplorerGraphData | null, mode: GraphMode): Set<string> {
  if (!data || mode !== 'structure') {
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

function collectDependencyNeighborIds(
  nodeId: string,
  edges: ExplorerGraphEdge[],
): string[] {
  const neighborIds = new Set<string>();

  for (const edge of edges) {
    if (edge.source === nodeId) {
      neighborIds.add(edge.target);
    }
    if (edge.target === nodeId) {
      neighborIds.add(edge.source);
    }
  }

  return Array.from(neighborIds);
}

function isVisible(
  node: ExplorerGraphNode,
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
  data: ExplorerGraphData | null,
  mode: GraphMode,
  depthFilter: DepthFilter,
  searchTerm: string,
  dependencyFilters: DependencyFilters,
) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const maxDepth = depthFilter === 'all' ? Number.POSITIVE_INFINITY : depthFilter;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  useEffect(() => {
    setCollapsedIds(buildDefaultCollapsedIds(data, mode));
  }, [data, mode]);

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
  if (mode === 'structure') {
    for (const edge of data.edges) {
      parentById.set(edge.target, edge.source);
    }
  }

  const filteredEdges = mode === 'dependencies'
    ? data.edges.filter((edge) => (
      (dependencyFilters.showTypeOnlyEdges || !edge.isTypeOnly) &&
      (dependencyFilters.showDynamicEdges || !edge.isDynamic)
    ))
    : data.edges;

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
    if (mode === 'structure') {
      for (const ancestorId of collectAncestorIds(nodeId, parentById)) {
        emphasizedNodeIds.add(ancestorId);
      }
    } else {
      for (const neighborId of collectDependencyNeighborIds(nodeId, filteredEdges)) {
        emphasizedNodeIds.add(neighborId);
      }
    }
  }

  const circularNodeIds = mode === 'dependencies'
    ? new Set(
      data.nodes
        .filter((node) => node.isCircular)
        .map((node) => node.id),
    )
    : new Set<string>();
  const orphanNodeIds = mode === 'dependencies'
    ? new Set(
      data.nodes
        .filter((node) => node.isOrphan)
        .map((node) => node.id),
    )
    : new Set<string>();

  const visibleNodes = data.nodes
    .filter((node) => (
      node.depth <= maxDepth &&
      (mode === 'structure'
        ? isVisible(node, parentById, collapsedIds, maxDepth) || emphasizedNodeIds.has(node.id)
        : true) &&
      (!dependencyFilters.circularOnly || circularNodeIds.has(node.id) || emphasizedNodeIds.has(node.id)) &&
      (!dependencyFilters.orphanOnly || orphanNodeIds.has(node.id) || emphasizedNodeIds.has(node.id))
    ))
    .map((node) => ({
      ...node,
      collapsed: mode === 'structure' && collapsedIds.has(node.id),
      hidden: false,
    }));

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = filteredEdges.filter((edge) => (
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
    if (mode !== 'structure') {
      return;
    }

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
    if (mode !== 'structure') {
      return;
    }
    setCollapsedIds(new Set());
  }

  function collapseAll() {
    if (mode !== 'structure') {
      return;
    }

    setCollapsedIds(new Set(
      data.nodes
        .filter((node) => node.kind === 'directory' && node.childCount > 0 && node.depth > 0)
        .map((node) => node.id),
    ));
  }

  function resetCollapsed() {
    setCollapsedIds(buildDefaultCollapsedIds(data, mode));
  }

  return {
    collapsedIds,
    visibleNodes,
    visibleEdges,
    matchedNodeIds: visibleMatchedNodeIds,
    emphasizedNodeIds,
    searchMatchCount: matchedNodeIds.size,
    collapsedCount: mode === 'structure' ? collapsedIds.size : 0,
    firstMatchedVisibleNodeId,
    toggleCollapsed,
    expandAll,
    collapseAll,
    resetCollapsed,
  };
}
