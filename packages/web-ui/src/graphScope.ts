import {
  filterDependencyEdges,
  getAncestorIds,
  type FileRelationshipIndex,
} from './relationshipIndex.js';
import type {
  DependencyFilters,
  ExplorerGraphEdge,
  ExplorerGraphNode,
  FileNeighborhoodDepth,
  FolderBoundaryMode,
  GraphScopeEdgeRole,
  GraphScopeNodeRole,
} from './types.js';

export interface ScopedGraph {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
  focusNodeId: string | null;
  totalNodeCount?: number;
  groupedNodeCount?: number;
  hiddenNodeCount?: number;
}

export interface GraphBreadcrumb {
  id: string;
  label: string;
  kind: ExplorerGraphNode['kind'];
}

export interface DependencyPathResult {
  connected: boolean;
  direction: 'forward' | 'reverse' | null;
  nodeIds: string[];
  edgeIds: string[];
}

const DEFAULT_FILTERS: DependencyFilters = {
  showTypeOnlyEdges: true,
  showDynamicEdges: true,
  circularOnly: false,
  orphanOnly: false,
};

export const DEFAULT_GRAPH_NODE_BUDGET = 80;

function sortNodes(nodes: ExplorerGraphNode[]): ExplorerGraphNode[] {
  return [...nodes].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function sortEdges(edges: ExplorerGraphEdge[]): ExplorerGraphEdge[] {
  return [...edges].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.id.localeCompare(b.id),
  );
}

function collectDistances(
  startId: string,
  adjacency: Map<string, ExplorerGraphEdge[]>,
  edgeTarget: (edge: ExplorerGraphEdge) => string,
  depth: FileNeighborhoodDepth,
): Map<string, number> {
  const distances = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  const maximumDepth = depth === 'all' ? Number.POSITIVE_INFINITY : depth;

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentDistance = distances.get(currentId) ?? 0;
    if (currentDistance >= maximumDepth) {
      continue;
    }

    for (const edge of adjacency.get(currentId) ?? []) {
      const nextId = edgeTarget(edge);
      if (distances.has(nextId)) {
        continue;
      }

      distances.set(nextId, currentDistance + 1);
      queue.push(nextId);
    }
  }

  return distances;
}

function roleForFileNeighborhood(
  nodeId: string,
  focusNodeId: string,
  importDistances: Map<string, number>,
  dependentDistances: Map<string, number>,
): GraphScopeNodeRole {
  if (nodeId === focusNodeId) {
    return 'focus';
  }

  const isImport = importDistances.has(nodeId);
  const isDependent = dependentDistances.has(nodeId);
  if (isImport && isDependent) {
    return 'related';
  }

  return isImport ? 'import' : 'dependent';
}

export function getFileNeighborhoodGraph(
  nodeId: string,
  index: FileRelationshipIndex,
  depth: FileNeighborhoodDepth,
  filters: DependencyFilters = DEFAULT_FILTERS,
): ScopedGraph {
  const focus = index.dependencyNodeById.get(nodeId);
  if (!focus || focus.kind !== 'file') {
    return { nodes: [], edges: [], focusNodeId: null };
  }

  const filteredEdges = filterDependencyEdges(index.dependencyEdges, filters);
  const importsBySource = new Map<string, ExplorerGraphEdge[]>();
  const dependentsByTarget = new Map<string, ExplorerGraphEdge[]>();

  for (const edge of filteredEdges) {
    const imports = importsBySource.get(edge.source) ?? [];
    imports.push(edge);
    importsBySource.set(edge.source, imports);

    const dependents = dependentsByTarget.get(edge.target) ?? [];
    dependents.push(edge);
    dependentsByTarget.set(edge.target, dependents);
  }

  const importDistances = collectDistances(nodeId, importsBySource, (edge) => edge.target, depth);
  const dependentDistances = collectDistances(
    nodeId,
    dependentsByTarget,
    (edge) => edge.source,
    depth,
  );
  const visibleNodeIds = new Set([...importDistances.keys(), ...dependentDistances.keys()]);
  const nodes = Array.from(visibleNodeIds)
    .map(
      (visibleNodeId) =>
        index.nodeById.get(visibleNodeId) ?? index.dependencyNodeById.get(visibleNodeId),
    )
    .filter((node): node is ExplorerGraphNode => Boolean(node))
    .map((node) => ({
      ...node,
      scopeRole: roleForFileNeighborhood(node.id, nodeId, importDistances, dependentDistances),
    }));
  const edges = filteredEdges
    .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
    .map((edge) => ({ ...edge, scopeRole: 'dependency' as const }));

  return limitGraphToBudget(
    {
      nodes: sortNodes(nodes),
      edges: sortEdges(edges),
      focusNodeId: nodeId,
    },
    index,
  );
}

function importance(node: ExplorerGraphNode, focusNodeId: string | null): number {
  if (node.id === focusNodeId) return Number.POSITIVE_INFINITY;
  const roleScore =
    node.scopeRole === 'dependent' || node.scopeRole === 'import'
      ? 1000
      : node.scopeRole === 'related'
        ? 900
        : 0;
  return roleScore + (node.inDegree ?? 0) * 4 + (node.outDegree ?? 0) * 2;
}

export function limitGraphToBudget(
  graph: ScopedGraph,
  index: FileRelationshipIndex,
  budget = DEFAULT_GRAPH_NODE_BUDGET,
): ScopedGraph {
  if (graph.nodes.length <= budget) {
    return {
      ...graph,
      totalNodeCount: graph.nodes.length,
      groupedNodeCount: 0,
      hiddenNodeCount: 0,
    };
  }

  const groupReserve = Math.min(16, Math.max(4, Math.floor(budget * 0.2)));
  const keptNodes = [...graph.nodes]
    .sort(
      (a, b) =>
        importance(b, graph.focusNodeId) - importance(a, graph.focusNodeId) ||
        a.relativePath.localeCompare(b.relativePath),
    )
    .slice(0, budget - groupReserve);
  const keptIds = new Set(keptNodes.map((node) => node.id));
  const groupedMembers = new Map<string, ExplorerGraphNode[]>();

  for (const node of graph.nodes) {
    if (keptIds.has(node.id)) continue;
    const folderId = index.parentById.get(node.id);
    if (!folderId) continue;
    const members = groupedMembers.get(folderId) ?? [];
    members.push(node);
    groupedMembers.set(folderId, members);
  }

  const selectedGroups = [...groupedMembers.entries()]
    .sort(
      ([aId, a], [bId, b]) =>
        b.length - a.length ||
        (index.nodeById.get(aId)?.relativePath ?? aId).localeCompare(
          index.nodeById.get(bId)?.relativePath ?? bId,
        ),
    )
    .slice(0, groupReserve);
  const selectedGroupById = new Map(selectedGroups);
  const nodeToBucket = new Map<string, string>();
  for (const [folderId, members] of selectedGroups) {
    members.forEach((member) => nodeToBucket.set(member.id, folderId));
  }

  const groupNodes = selectedGroups.flatMap(([folderId, members]) => {
    const folder = index.nodeById.get(folderId) ?? index.structureNodeById.get(folderId);
    if (!folder || keptIds.has(folderId)) return [];
    const roles = new Set(members.map((member) => member.scopeRole));
    return [
      {
        ...folder,
        scopeRole: roles.size === 1 ? members[0]?.scopeRole : 'related',
        memberNodeIds: members.map((member) => member.id).sort(),
        memberCount: members.length,
      } satisfies ExplorerGraphNode,
    ];
  });
  const enrichedKeptNodes = keptNodes.map((node) => {
    const grouped = selectedGroupById.get(node.id);
    if (!grouped) return node;
    return {
      ...node,
      memberNodeIds: [...(node.memberNodeIds ?? []), ...grouped.map((member) => member.id)].sort(),
      memberCount: (node.memberCount ?? 0) + grouped.length,
    };
  });
  const representedGroupIds = new Set([
    ...groupNodes.map((node) => node.id),
    ...selectedGroups.filter(([folderId]) => keptIds.has(folderId)).map(([folderId]) => folderId),
  ]);
  const visibleIds = new Set([...keptIds, ...groupNodes.map((node) => node.id)]);
  const aggregates = new Map<string, ExplorerGraphEdge>();

  for (const edge of graph.edges) {
    const source = keptIds.has(edge.source) ? edge.source : nodeToBucket.get(edge.source);
    const target = keptIds.has(edge.target) ? edge.target : nodeToBucket.get(edge.target);
    if (
      !source ||
      !target ||
      source === target ||
      !visibleIds.has(source) ||
      !visibleIds.has(target)
    ) {
      continue;
    }
    const key = `${source}->${target}`;
    const existing = aggregates.get(key);
    if (!existing) {
      aggregates.set(key, {
        ...edge,
        id: `limited:${key}`,
        source,
        target,
        aggregateCount: edge.aggregateCount ?? 1,
        memberEdgeIds: edge.memberEdgeIds ?? [edge.id],
      });
      continue;
    }
    existing.aggregateCount = (existing.aggregateCount ?? 1) + (edge.aggregateCount ?? 1);
    existing.memberEdgeIds = [
      ...(existing.memberEdgeIds ?? []),
      ...(edge.memberEdgeIds ?? [edge.id]),
    ];
    existing.isCrossPackage ||= edge.isCrossPackage;
    existing.ruleViolations = [...(existing.ruleViolations ?? []), ...(edge.ruleViolations ?? [])];
  }

  return {
    nodes: sortNodes([...enrichedKeptNodes, ...groupNodes]),
    edges: sortEdges([...aggregates.values()]),
    focusNodeId: graph.focusNodeId,
    totalNodeCount: graph.nodes.length,
    groupedNodeCount: representedGroupIds.size,
    hiddenNodeCount:
      graph.nodes.length -
      keptNodes.length -
      [...representedGroupIds].reduce(
        (count, groupId) => count + (groupedMembers.get(groupId)?.length ?? 0),
        0,
      ),
  };
}

export function getProjectOverviewGraph(
  index: FileRelationshipIndex,
  filters: DependencyFilters = DEFAULT_FILTERS,
): ScopedGraph {
  if (!index.rootId) return { nodes: [], edges: [], focusNodeId: null };
  return getFolderBoundaryGraph(index.rootId, index, 'all', filters);
}

export function getCircularDependenciesGraph(
  index: FileRelationshipIndex,
  filters: DependencyFilters = DEFAULT_FILTERS,
): ScopedGraph {
  const nodes = [...index.circularNodeIds]
    .map((id) => index.nodeById.get(id))
    .filter((node): node is ExplorerGraphNode => Boolean(node));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = filterDependencyEdges(index.dependencyEdges, filters).filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  return limitGraphToBudget({ nodes, edges, focusNodeId: null }, index);
}

export function getArchitectureViolationsGraph(
  index: FileRelationshipIndex,
  filters: DependencyFilters = DEFAULT_FILTERS,
): ScopedGraph {
  const edges = filterDependencyEdges(index.dependencyEdges, filters).filter(
    (edge) => (edge.ruleViolations?.length ?? 0) > 0,
  );
  const ids = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = [...ids]
    .map((id) => index.nodeById.get(id))
    .filter((node): node is ExplorerGraphNode => Boolean(node));
  return limitGraphToBudget({ nodes, edges, focusNodeId: null }, index);
}

export function getHighImpactGraph(
  index: FileRelationshipIndex,
  filters: DependencyFilters = DEFAULT_FILTERS,
): ScopedGraph {
  const ranked = [...index.dependencyNodeById.values()]
    .sort(
      (a, b) =>
        (b.inDegree ?? 0) - (a.inDegree ?? 0) ||
        (b.outDegree ?? 0) - (a.outDegree ?? 0) ||
        a.relativePath.localeCompare(b.relativePath),
    )
    .slice(0, 24);
  const hubIds = new Set(ranked.map((node) => node.id));
  const relevantEdges = filterDependencyEdges(index.dependencyEdges, filters).filter(
    (edge) => hubIds.has(edge.source) || hubIds.has(edge.target),
  );
  const ids = new Set(relevantEdges.flatMap((edge) => [edge.source, edge.target]));
  ranked.forEach((node) => ids.add(node.id));
  const nodes = [...ids]
    .map((id) => index.nodeById.get(id))
    .filter((node): node is ExplorerGraphNode => Boolean(node));
  return limitGraphToBudget({ nodes, edges: relevantEdges, focusNodeId: null }, index);
}

function directChildUnder(
  nodeId: string,
  folderId: string,
  index: FileRelationshipIndex,
): string | null {
  let currentId = nodeId;
  let parentId = index.parentById.get(currentId);

  while (parentId && parentId !== folderId) {
    currentId = parentId;
    parentId = index.parentById.get(currentId);
  }

  return parentId === folderId ? currentId : null;
}

function externalBucket(nodeId: string, index: FileRelationshipIndex): string {
  const parentId = index.parentById.get(nodeId);
  if (!parentId || parentId === index.rootId) {
    return nodeId;
  }

  return parentId;
}

function mergeNodeRole(
  current: GraphScopeNodeRole | undefined,
  next: GraphScopeNodeRole,
): GraphScopeNodeRole {
  if (!current || current === next) {
    return next;
  }
  if (
    (current === 'external-incoming' && next === 'external-outgoing') ||
    (current === 'external-outgoing' && next === 'external-incoming') ||
    current === 'external-both'
  ) {
    return 'external-both';
  }
  if (current === 'focus' || next === 'focus') {
    return 'focus';
  }
  return current;
}

interface AggregatedEdge {
  source: string;
  target: string;
  role: GraphScopeEdgeRole;
  edges: ExplorerGraphEdge[];
}

function includeBoundaryRole(mode: FolderBoundaryMode, role: GraphScopeEdgeRole): boolean {
  return mode === 'all' || mode === role;
}

export function getFolderBoundaryGraph(
  folderId: string,
  index: FileRelationshipIndex,
  mode: FolderBoundaryMode = 'all',
  filters: DependencyFilters = DEFAULT_FILTERS,
): ScopedGraph {
  const folder = index.structureNodeById.get(folderId) ?? index.nodeById.get(folderId);
  if (!folder || folder.kind !== 'directory') {
    return { nodes: [], edges: [], focusNodeId: null };
  }

  const fileIds = new Set(index.filesByFolderId.get(folderId) ?? []);
  const membersByBucket = new Map<string, Set<string>>();
  const rolesByBucket = new Map<string, GraphScopeNodeRole>();
  const internalEdgesByBucket = new Map<string, Set<string>>();
  const aggregatedEdges = new Map<string, AggregatedEdge>();

  function addBucket(bucketId: string, memberId: string, role: GraphScopeNodeRole) {
    const members = membersByBucket.get(bucketId) ?? new Set<string>();
    members.add(memberId);
    membersByBucket.set(bucketId, members);
    rolesByBucket.set(bucketId, mergeNodeRole(rolesByBucket.get(bucketId), role));
  }

  function addAggregatedEdge(
    source: string,
    target: string,
    role: GraphScopeEdgeRole,
    edge: ExplorerGraphEdge,
  ) {
    if (source === target) {
      const internalEdges = internalEdgesByBucket.get(source) ?? new Set<string>();
      internalEdges.add(edge.id);
      internalEdgesByBucket.set(source, internalEdges);
      return;
    }

    const key = `${role}:${source}->${target}`;
    const aggregate = aggregatedEdges.get(key) ?? { source, target, role, edges: [] };
    aggregate.edges.push(edge);
    aggregatedEdges.set(key, aggregate);
  }

  for (const child of index.childrenByParentId.get(folderId) ?? []) {
    if (child.kind === 'file') {
      addBucket(child.id, child.id, 'internal');
      continue;
    }

    for (const memberId of index.filesByFolderId.get(child.id) ?? []) {
      addBucket(child.id, memberId, 'internal');
    }
    if ((index.filesByFolderId.get(child.id) ?? []).length === 0) {
      addBucket(child.id, child.id, 'internal');
    }
  }

  for (const edge of filterDependencyEdges(index.dependencyEdges, filters)) {
    const sourceInside = fileIds.has(edge.source);
    const targetInside = fileIds.has(edge.target);
    let role: GraphScopeEdgeRole | null = null;

    if (sourceInside && targetInside) {
      role = 'internal';
    } else if (!sourceInside && targetInside) {
      role = 'incoming';
    } else if (sourceInside && !targetInside) {
      role = 'outgoing';
    }

    if (!role || !includeBoundaryRole(mode, role)) {
      continue;
    }

    const sourceBucket = sourceInside
      ? directChildUnder(edge.source, folderId, index)
      : externalBucket(edge.source, index);
    const targetBucket = targetInside
      ? directChildUnder(edge.target, folderId, index)
      : externalBucket(edge.target, index);
    if (!sourceBucket || !targetBucket) {
      continue;
    }

    addBucket(
      sourceBucket,
      edge.source,
      sourceInside ? 'internal' : role === 'incoming' ? 'external-incoming' : 'external-outgoing',
    );
    addBucket(
      targetBucket,
      edge.target,
      targetInside ? 'internal' : role === 'outgoing' ? 'external-outgoing' : 'external-incoming',
    );
    addAggregatedEdge(sourceBucket, targetBucket, role, edge);
  }

  const focusMembers = Array.from(fileIds);
  const nodes: ExplorerGraphNode[] = [
    {
      ...folder,
      scopeRole: 'focus',
      memberNodeIds: focusMembers,
      memberCount: focusMembers.length,
    },
  ];

  for (const [bucketId, members] of membersByBucket) {
    const node = index.nodeById.get(bucketId) ?? index.structureNodeById.get(bucketId);
    if (!node || bucketId === folderId) {
      continue;
    }

    nodes.push({
      ...node,
      scopeRole: rolesByBucket.get(bucketId) ?? 'internal',
      memberNodeIds: Array.from(members).sort(),
      memberCount: members.size,
      internalEdgeCount: internalEdgesByBucket.get(bucketId)?.size ?? 0,
    });
  }

  const edges: ExplorerGraphEdge[] = [];
  for (const aggregate of aggregatedEdges.values()) {
    const firstEdge = aggregate.edges[0];
    edges.push({
      ...firstEdge,
      id: `scope:${aggregate.role}:${aggregate.source}->${aggregate.target}`,
      source: aggregate.source,
      target: aggregate.target,
      scopeRole: aggregate.role,
      aggregateCount: aggregate.edges.length,
      memberEdgeIds: aggregate.edges.map((edge) => edge.id).sort(),
      isCrossPackage: aggregate.edges.some((edge) => edge.isCrossPackage),
      ruleViolations: aggregate.edges.flatMap((edge) => edge.ruleViolations ?? []),
    });
  }

  for (const node of nodes) {
    if (node.id === folderId || node.scopeRole !== 'internal') {
      continue;
    }
    edges.push({
      id: `scope:membership:${folderId}->${node.id}`,
      source: folderId,
      target: node.id,
      kind: 'dependencies',
      scopeRole: 'membership',
      aggregateCount: node.memberCount ?? 1,
      memberEdgeIds: [],
    });
  }

  return limitGraphToBudget(
    {
      nodes: sortNodes(nodes),
      edges: sortEdges(edges),
      focusNodeId: folderId,
    },
    index,
  );
}

export function getGraphBreadcrumbs(
  nodeId: string | null,
  index: FileRelationshipIndex,
): GraphBreadcrumb[] {
  if (!nodeId) {
    return [];
  }

  return [...getAncestorIds(nodeId, index).reverse(), nodeId]
    .map((id) => index.nodeById.get(id) ?? index.structureNodeById.get(id))
    .filter((node): node is ExplorerGraphNode => Boolean(node))
    .map((node) => ({ id: node.id, label: node.label, kind: node.kind }));
}

function findDirectedPath(
  fromId: string,
  toId: string,
  edges: ExplorerGraphEdge[],
): { nodeIds: string[]; edgeIds: string[] } | null {
  const adjacency = new Map<string, ExplorerGraphEdge[]>();
  for (const edge of edges) {
    const current = adjacency.get(edge.source) ?? [];
    current.push(edge);
    adjacency.set(edge.source, current);
  }
  for (const [source, sourceEdges] of adjacency) {
    adjacency.set(source, sortEdges(sourceEdges));
  }

  const queue = [fromId];
  const visited = new Set<string>([fromId]);
  const predecessor = new Map<string, { nodeId: string; edgeId: string }>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const edge of adjacency.get(currentId) ?? []) {
      if (visited.has(edge.target)) {
        continue;
      }
      visited.add(edge.target);
      predecessor.set(edge.target, { nodeId: currentId, edgeId: edge.id });
      if (edge.target === toId) {
        const nodeIds = [toId];
        const edgeIds: string[] = [];
        let pathNodeId = toId;
        while (pathNodeId !== fromId) {
          const previous = predecessor.get(pathNodeId);
          if (!previous) {
            return null;
          }
          nodeIds.unshift(previous.nodeId);
          edgeIds.unshift(previous.edgeId);
          pathNodeId = previous.nodeId;
        }
        return { nodeIds, edgeIds };
      }
      queue.push(edge.target);
    }
  }

  return null;
}

export function getShortestDependencyPath(
  fromId: string,
  toId: string,
  index: FileRelationshipIndex,
  filters: DependencyFilters = DEFAULT_FILTERS,
): DependencyPathResult {
  if (fromId === toId) {
    return { connected: true, direction: 'forward', nodeIds: [fromId], edgeIds: [] };
  }

  const edges = filterDependencyEdges(index.dependencyEdges, filters);
  const forward = findDirectedPath(fromId, toId, edges);
  if (forward) {
    return { connected: true, direction: 'forward', ...forward };
  }

  const reverse = findDirectedPath(toId, fromId, edges);
  if (reverse) {
    return { connected: true, direction: 'reverse', ...reverse };
  }

  return { connected: false, direction: null, nodeIds: [], edgeIds: [] };
}
