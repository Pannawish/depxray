import type {
  DependencyFilters,
  ExplorerGraphData,
  ExplorerGraphEdge,
  ExplorerGraphNode,
  ExplorerGraphSet,
} from './types.js';

export interface FileRelationshipIndex {
  rootId: string | null;
  projectRoot: string;
  structureGraph: ExplorerGraphData | null;
  dependencyGraph: ExplorerGraphData | null;
  nodeById: Map<string, ExplorerGraphNode>;
  structureNodeById: Map<string, ExplorerGraphNode>;
  dependencyNodeById: Map<string, ExplorerGraphNode>;
  childrenByParentId: Map<string, ExplorerGraphNode[]>;
  parentById: Map<string, string>;
  importsBySourceId: Map<string, ExplorerGraphEdge[]>;
  importedByTargetId: Map<string, ExplorerGraphEdge[]>;
  circularNodeIds: Set<string>;
  orphanNodeIds: Set<string>;
  descendantsById: Map<string, string[]>;
  filesByFolderId: Map<string, string[]>;
  dependencyEdges: ExplorerGraphEdge[];
}

export interface FolderSummary {
  folderId: string;
  totalFiles: number;
  directChildren: number;
  descendants: number;
  internalImports: ExplorerGraphEdge[];
  incomingExternal: ExplorerGraphEdge[];
  outgoingExternal: ExplorerGraphEdge[];
  circularFiles: ExplorerGraphNode[];
  orphanFiles: ExplorerGraphNode[];
}

const EMPTY_FILTERS: DependencyFilters = {
  showTypeOnlyEdges: true,
  showDynamicEdges: true,
  circularOnly: false,
  orphanOnly: false,
};

function sortTreeNodes(nodes: ExplorerGraphNode[]): ExplorerGraphNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }

    return a.label.localeCompare(b.label);
  });
}

function mergeNode(
  structureNode: ExplorerGraphNode | undefined,
  dependencyNode: ExplorerGraphNode,
): ExplorerGraphNode {
  if (!structureNode) {
    return dependencyNode;
  }

  return {
    ...structureNode,
    inDegree: dependencyNode.inDegree,
    outDegree: dependencyNode.outDegree,
    isCircular: dependencyNode.isCircular,
    isOrphan: dependencyNode.isOrphan,
    componentName: dependencyNode.componentName,
    metrics: dependencyNode.metrics,
  };
}

function pushMapValue<TKey, TValue>(
  map: Map<TKey, TValue[]>,
  key: TKey,
  value: TValue,
) {
  const current = map.get(key);
  if (current) {
    current.push(value);
    return;
  }

  map.set(key, [value]);
}

function collectDescendants(
  nodeId: string,
  childrenByParentId: Map<string, ExplorerGraphNode[]>,
  descendantsById: Map<string, string[]>,
  filesByFolderId: Map<string, string[]>,
): { descendants: string[]; files: string[] } {
  const descendants: string[] = [];
  const files: string[] = [];
  const children = childrenByParentId.get(nodeId) ?? [];

  for (const child of children) {
    descendants.push(child.id);

    if (child.kind === 'file') {
      files.push(child.id);
      continue;
    }

    const childResult = collectDescendants(
      child.id,
      childrenByParentId,
      descendantsById,
      filesByFolderId,
    );
    descendants.push(...childResult.descendants);
    files.push(...childResult.files);
  }

  descendantsById.set(nodeId, descendants);
  filesByFolderId.set(nodeId, files);

  return { descendants, files };
}

export function buildRelationshipIndex(
  dataSet: ExplorerGraphSet | null,
): FileRelationshipIndex {
  const structureGraph = dataSet?.graphs.structure ?? null;
  const dependencyGraph = dataSet?.graphs.dependencies ?? null;
  const structureNodeById = new Map<string, ExplorerGraphNode>();
  const dependencyNodeById = new Map<string, ExplorerGraphNode>();
  const nodeById = new Map<string, ExplorerGraphNode>();
  const childrenByParentId = new Map<string, ExplorerGraphNode[]>();
  const parentById = new Map<string, string>();
  const importsBySourceId = new Map<string, ExplorerGraphEdge[]>();
  const importedByTargetId = new Map<string, ExplorerGraphEdge[]>();
  const circularNodeIds = new Set<string>();
  const orphanNodeIds = new Set<string>();
  const descendantsById = new Map<string, string[]>();
  const filesByFolderId = new Map<string, string[]>();

  for (const node of structureGraph?.nodes ?? []) {
    structureNodeById.set(node.id, node);
    nodeById.set(node.id, node);
  }

  for (const node of dependencyGraph?.nodes ?? []) {
    dependencyNodeById.set(node.id, node);
    nodeById.set(node.id, mergeNode(structureNodeById.get(node.id), node));

    if (node.isCircular) {
      circularNodeIds.add(node.id);
    }

    if (node.isOrphan) {
      orphanNodeIds.add(node.id);
    }
  }

  for (const edge of structureGraph?.edges ?? []) {
    const child = nodeById.get(edge.target) ?? structureNodeById.get(edge.target);
    if (!child) {
      continue;
    }

    parentById.set(edge.target, edge.source);
    pushMapValue(childrenByParentId, edge.source, child);
  }

  for (const [parentId, children] of childrenByParentId) {
    childrenByParentId.set(parentId, sortTreeNodes(children));
  }

  const dependencyEdges = dependencyGraph?.edges ?? [];
  for (const edge of dependencyEdges) {
    pushMapValue(importsBySourceId, edge.source, edge);
    pushMapValue(importedByTargetId, edge.target, edge);
  }

  const rootId = structureGraph?.nodes.find((node) => node.depth === 0)?.id
    ?? structureGraph?.nodes.find((node) => node.relativePath === '.')?.id
    ?? null;

  if (rootId) {
    collectDescendants(rootId, childrenByParentId, descendantsById, filesByFolderId);
  }

  for (const node of structureGraph?.nodes ?? []) {
    if (node.kind === 'file') {
      descendantsById.set(node.id, []);
      filesByFolderId.set(node.id, [node.id]);
    } else if (!descendantsById.has(node.id)) {
      collectDescendants(node.id, childrenByParentId, descendantsById, filesByFolderId);
    }
  }

  return {
    rootId,
    projectRoot: dataSet?.projectRoot ?? structureGraph?.projectRoot ?? dependencyGraph?.projectRoot ?? '',
    structureGraph,
    dependencyGraph,
    nodeById,
    structureNodeById,
    dependencyNodeById,
    childrenByParentId,
    parentById,
    importsBySourceId,
    importedByTargetId,
    circularNodeIds,
    orphanNodeIds,
    descendantsById,
    filesByFolderId,
    dependencyEdges,
  };
}

export function filterDependencyEdges(
  edges: ExplorerGraphEdge[],
  filters: DependencyFilters = EMPTY_FILTERS,
): ExplorerGraphEdge[] {
  return edges.filter((edge) => (
    (filters.showTypeOnlyEdges || !edge.isTypeOnly) &&
    (filters.showDynamicEdges || !edge.isDynamic)
  ));
}

export function getAncestorIds(
  nodeId: string,
  index: FileRelationshipIndex,
): string[] {
  const ancestors: string[] = [];
  let currentParentId = index.parentById.get(nodeId);

  while (currentParentId) {
    ancestors.push(currentParentId);
    currentParentId = index.parentById.get(currentParentId);
  }

  return ancestors;
}

export function getFolderSummary(
  folderId: string,
  index: FileRelationshipIndex,
  filters: DependencyFilters = EMPTY_FILTERS,
): FolderSummary {
  const fileIds = new Set(index.filesByFolderId.get(folderId) ?? []);
  const filteredEdges = filterDependencyEdges(index.dependencyEdges, filters);
  const circularFiles = Array.from(fileIds)
    .filter((fileId) => index.circularNodeIds.has(fileId))
    .map((fileId) => index.nodeById.get(fileId))
    .filter((node): node is ExplorerGraphNode => Boolean(node));
  const orphanFiles = Array.from(fileIds)
    .filter((fileId) => index.orphanNodeIds.has(fileId))
    .map((fileId) => index.nodeById.get(fileId))
    .filter((node): node is ExplorerGraphNode => Boolean(node));

  return {
    folderId,
    totalFiles: fileIds.size,
    directChildren: index.childrenByParentId.get(folderId)?.length ?? 0,
    descendants: index.descendantsById.get(folderId)?.length ?? 0,
    internalImports: filteredEdges.filter((edge) => (
      fileIds.has(edge.source) && fileIds.has(edge.target)
    )),
    incomingExternal: filteredEdges.filter((edge) => (
      !fileIds.has(edge.source) && fileIds.has(edge.target)
    )),
    outgoingExternal: filteredEdges.filter((edge) => (
      fileIds.has(edge.source) && !fileIds.has(edge.target)
    )),
    circularFiles,
    orphanFiles,
  };
}
