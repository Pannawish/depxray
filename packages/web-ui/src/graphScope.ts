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

  return {
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
    focusNodeId: nodeId,
  };
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

  return {
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
    focusNodeId: folderId,
  };
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
