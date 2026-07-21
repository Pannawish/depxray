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
  unusedExportNodeIds: Set<string>;
  unresolvedImportNodeIds: Set<string>;
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

export type ImpactRiskLevel = 'low' | 'medium' | 'high';

export interface ImpactSummaryFile {
  node: ExplorerGraphNode;
  distance: number;
  path: ExplorerGraphNode[];
  risk: ImpactRiskLevel;
  riskFactors: string[];
}

export interface ImpactSummary {
  targetNodeId: string;
  target: ExplorerGraphNode;
  affectedNodeIds: Set<string>;
  impactNodeIds: Set<string>;
  impactEdgeIds: Set<string>;
  affectedFiles: ImpactSummaryFile[];
  directDependents: ImpactSummaryFile[];
  highImpactComplexFiles: ImpactSummaryFile[];
  affectedCount: number;
  directDependentCount: number;
  maxDistance: number;
  risk: ImpactRiskLevel;
}

const EMPTY_FILTERS: DependencyFilters = {
  showTypeOnlyEdges: true,
  showDynamicEdges: true,
  circularOnly: false,
  orphanOnly: false,
};

const HIGH_COMPLEXITY_THRESHOLD = 10;
const HIGH_IMPACT_DEPENDENT_THRESHOLD = 10;
const HIGH_INBOUND_THRESHOLD = 5;

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
    workspace: dependencyNode.workspace,
    metrics: dependencyNode.metrics,
    unusedExports: dependencyNode.unusedExports,
    unresolvedImports: dependencyNode.unresolvedImports,
    pluginData: dependencyNode.pluginData,
  };
}

function pushMapValue<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
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

export function buildRelationshipIndex(dataSet: ExplorerGraphSet | null): FileRelationshipIndex {
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
  const unusedExportNodeIds = new Set<string>();
  const unresolvedImportNodeIds = new Set<string>();
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

    if ((node.unusedExports?.length ?? 0) > 0) {
      unusedExportNodeIds.add(node.id);
    }

    if ((node.unresolvedImports?.length ?? 0) > 0) {
      unresolvedImportNodeIds.add(node.id);
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

  const rootId =
    structureGraph?.nodes.find((node) => node.depth === 0)?.id ??
    structureGraph?.nodes.find((node) => node.relativePath === '.')?.id ??
    null;

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
    projectRoot:
      dataSet?.projectRoot ?? structureGraph?.projectRoot ?? dependencyGraph?.projectRoot ?? '',
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
    unusedExportNodeIds,
    unresolvedImportNodeIds,
    descendantsById,
    filesByFolderId,
    dependencyEdges,
  };
}

export function filterDependencyEdges(
  edges: ExplorerGraphEdge[],
  filters: DependencyFilters = EMPTY_FILTERS,
): ExplorerGraphEdge[] {
  return edges.filter(
    (edge) =>
      (filters.showTypeOnlyEdges || !edge.isTypeOnly) &&
      (filters.showDynamicEdges || !edge.isDynamic),
  );
}

export function getAncestorIds(nodeId: string, index: FileRelationshipIndex): string[] {
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
    internalImports: filteredEdges.filter(
      (edge) => fileIds.has(edge.source) && fileIds.has(edge.target),
    ),
    incomingExternal: filteredEdges.filter(
      (edge) => !fileIds.has(edge.source) && fileIds.has(edge.target),
    ),
    outgoingExternal: filteredEdges.filter(
      (edge) => fileIds.has(edge.source) && !fileIds.has(edge.target),
    ),
    circularFiles,
    orphanFiles,
  };
}

function nodeComplexity(node: ExplorerGraphNode): number {
  return node.metrics?.cyclomaticComplexity ?? 0;
}

function riskFactorsForNode(
  node: ExplorerGraphNode,
  targetNodeId: string,
  affectedCount: number,
): string[] {
  const factors: string[] = [];
  const isTarget = node.id === targetNodeId;
  const complexity = nodeComplexity(node);

  if (isTarget && affectedCount >= HIGH_IMPACT_DEPENDENT_THRESHOLD) {
    factors.push(`${affectedCount} transitive dependents`);
  }

  if (!isTarget && (node.inDegree ?? 0) >= HIGH_INBOUND_THRESHOLD) {
    factors.push(`${node.inDegree ?? 0} incoming imports`);
  }

  if (complexity >= HIGH_COMPLEXITY_THRESHOLD) {
    factors.push(`complexity ${complexity}`);
  }

  if (node.isCircular) {
    factors.push('circular dependency');
  }

  return factors;
}

function riskFromFactors(factors: string[]): ImpactRiskLevel {
  const hasComplexity = factors.some((factor) => factor.startsWith('complexity '));
  const hasImpact = factors.some(
    (factor) => factor.endsWith('transitive dependents') || factor.endsWith('incoming imports'),
  );

  if ((hasComplexity && hasImpact) || factors.includes('circular dependency')) {
    return 'high';
  }

  if (factors.length > 0) {
    return 'medium';
  }

  return 'low';
}

function isHighImpactComplexFile(
  file: ImpactSummaryFile,
  targetNodeId: string,
  affectedCount: number,
): boolean {
  const isHighImpact =
    file.node.id === targetNodeId
      ? affectedCount >= HIGH_IMPACT_DEPENDENT_THRESHOLD
      : (file.node.inDegree ?? 0) >= HIGH_INBOUND_THRESHOLD;

  return isHighImpact && nodeComplexity(file.node) >= HIGH_COMPLEXITY_THRESHOLD;
}

function overallImpactRisk(
  targetFile: ImpactSummaryFile,
  affectedCount: number,
  directDependentCount: number,
  highImpactComplexCount: number,
): ImpactRiskLevel {
  if (targetFile.risk === 'high' || highImpactComplexCount > 0 || affectedCount >= 20) {
    return 'high';
  }

  if (targetFile.risk === 'medium' || affectedCount >= 5 || directDependentCount >= 3) {
    return 'medium';
  }

  return 'low';
}

export function getImpactSummary(
  nodeId: string,
  index: FileRelationshipIndex,
): ImpactSummary | null {
  const target = index.dependencyNodeById.get(nodeId);
  if (!target || target.kind !== 'file') {
    return null;
  }

  const visited = new Set<string>([target.id]);
  const queue: Array<{
    nodeId: string;
    distance: number;
    pathIds: string[];
    edgeIds: string[];
  }> = [{ nodeId: target.id, distance: 0, pathIds: [target.id], edgeIds: [] }];
  const affected: Array<{
    node: ExplorerGraphNode;
    distance: number;
    pathIds: string[];
    edgeIds: string[];
  }> = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const edge of index.importedByTargetId.get(current.nodeId) ?? []) {
      if (visited.has(edge.source)) {
        continue;
      }

      const sourceNode = index.dependencyNodeById.get(edge.source);
      if (!sourceNode) {
        continue;
      }

      const next = {
        node: sourceNode,
        distance: current.distance + 1,
        pathIds: [sourceNode.id, ...current.pathIds],
        edgeIds: [edge.id, ...current.edgeIds],
      };
      visited.add(sourceNode.id);
      affected.push(next);
      queue.push({
        nodeId: sourceNode.id,
        distance: next.distance,
        pathIds: next.pathIds,
        edgeIds: next.edgeIds,
      });
    }
  }

  const affectedCount = affected.length;
  const toFile = (
    node: ExplorerGraphNode,
    distance: number,
    pathIds: string[],
  ): ImpactSummaryFile => {
    const factors = riskFactorsForNode(node, target.id, affectedCount);

    return {
      node,
      distance,
      path: pathIds
        .map((pathId) => index.dependencyNodeById.get(pathId) ?? index.nodeById.get(pathId))
        .filter((item): item is ExplorerGraphNode => Boolean(item)),
      risk: riskFromFactors(factors),
      riskFactors: factors,
    };
  };
  const affectedFiles = affected
    .map((item) => toFile(item.node, item.distance, item.pathIds))
    .sort(
      (a, b) => a.distance - b.distance || a.node.relativePath.localeCompare(b.node.relativePath),
    );
  const targetFile = toFile(target, 0, [target.id]);
  const directDependents = affectedFiles.filter((item) => item.distance === 1);
  const highImpactComplexFiles = [targetFile, ...affectedFiles].filter((item) =>
    isHighImpactComplexFile(item, target.id, affectedCount),
  );
  const impactEdgeIds = new Set<string>();
  for (const item of affected) {
    for (const edgeId of item.edgeIds) {
      impactEdgeIds.add(edgeId);
    }
  }

  return {
    targetNodeId: target.id,
    target,
    affectedNodeIds: new Set(affectedFiles.map((item) => item.node.id)),
    impactNodeIds: new Set([target.id, ...affectedFiles.map((item) => item.node.id)]),
    impactEdgeIds,
    affectedFiles,
    directDependents,
    highImpactComplexFiles,
    affectedCount,
    directDependentCount: directDependents.length,
    maxDistance: affectedFiles.reduce((max, item) => Math.max(max, item.distance), 0),
    risk: overallImpactRisk(
      targetFile,
      affectedCount,
      directDependents.length,
      highImpactComplexFiles.length,
    ),
  };
}
