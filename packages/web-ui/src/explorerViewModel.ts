import type { FileTreeRowData } from './components/FileTreeView.js';
import { getAncestorIds, type FileRelationshipIndex } from './relationshipIndex.js';
import type { DependencyFilters, ExplorerGraphNode, GraphMode, GraphScopeMode } from './types.js';

export function buildInitialExpandedIds(index: FileRelationshipIndex): Set<string> {
  return index.rootId ? new Set([index.rootId]) : new Set();
}

export function firstSelectableNode(index: FileRelationshipIndex): ExplorerGraphNode | null {
  return index.rootId
    ? (index.nodeById.get(index.rootId) ?? null)
    : (Array.from(index.nodeById.values())[0] ?? null);
}

export function scopeModeForNode(
  node: ExplorerGraphNode | null | undefined,
  index: FileRelationshipIndex,
): GraphScopeMode {
  if (node?.kind === 'file' && index.dependencyNodeById.has(node.id)) return 'file';
  if (node?.kind === 'directory' && node.id !== index.rootId && index.dependencyGraph)
    return 'folder';
  return 'project';
}

function collectVisibleIds(sourceIds: Iterable<string>, index: FileRelationshipIndex): Set<string> {
  const visibleIds = new Set<string>();
  for (const nodeId of sourceIds) {
    visibleIds.add(nodeId);
    getAncestorIds(nodeId, index).forEach((ancestorId) => visibleIds.add(ancestorId));
  }
  return visibleIds;
}

export function buildTreeRows(
  index: FileRelationshipIndex,
  expandedIds: Set<string>,
  searchTerm: string,
  filters: DependencyFilters,
): FileTreeRowData[] {
  const rows: FileTreeRowData[] = [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const structureNodes = Array.from(index.nodeById.values());
  const searchMatches = structureNodes.filter(
    (node) =>
      node.label.toLowerCase().includes(normalizedSearch) ||
      node.relativePath.toLowerCase().includes(normalizedSearch),
  );
  const searchMatchedIds = new Set(searchMatches.map((node) => node.id));
  const searchVisibleIds = normalizedSearch
    ? collectVisibleIds(searchMatchedIds, index)
    : new Set<string>();
  const circularVisibleIds = filters.circularOnly
    ? collectVisibleIds(index.circularNodeIds, index)
    : new Set<string>();
  const orphanVisibleIds = filters.orphanOnly
    ? collectVisibleIds(index.orphanNodeIds, index)
    : new Set<string>();
  const unusedVisibleIds = filters.unusedExportsOnly
    ? collectVisibleIds(index.unusedExportNodeIds, index)
    : new Set<string>();

  function shouldShow(nodeId: string): boolean {
    return (
      (!normalizedSearch || searchVisibleIds.has(nodeId)) &&
      (!filters.circularOnly || circularVisibleIds.has(nodeId)) &&
      (!filters.orphanOnly || orphanVisibleIds.has(nodeId)) &&
      (!filters.unusedExportsOnly || unusedVisibleIds.has(nodeId))
    );
  }

  function visit(node: ExplorerGraphNode, level: number): void {
    if (!shouldShow(node.id)) return;
    const children = index.childrenByParentId.get(node.id) ?? [];
    const forceExpanded =
      Boolean(normalizedSearch) ||
      filters.circularOnly ||
      filters.orphanOnly ||
      Boolean(filters.unusedExportsOnly);
    const expanded = expandedIds.has(node.id) || forceExpanded;
    rows.push({
      node,
      level,
      hasChildren: children.length > 0,
      expanded,
      matched: searchMatchedIds.has(node.id),
      circular: index.circularNodeIds.has(node.id),
      orphan: index.orphanNodeIds.has(node.id),
      unusedExports: (node.unusedExports?.length ?? 0) > 0,
      unresolvedImports: (node.unresolvedImports?.length ?? 0) > 0,
    });
    if (expanded) children.forEach((child) => visit(child, level + 1));
  }

  if (index.rootId) {
    const root = index.nodeById.get(index.rootId);
    if (root) visit(root, 0);
  } else {
    structureNodes.forEach((node) => visit(node, 0));
  }
  return rows;
}

export function buildGraphNodes(
  index: FileRelationshipIndex,
  graphMode: GraphMode,
  searchTerm: string,
  filters: DependencyFilters,
): ExplorerGraphNode[] {
  const sourceNodes =
    graphMode === 'dependencies'
      ? (index.dependencyGraph?.nodes ?? [])
      : (index.structureGraph?.nodes ?? []);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (
    !normalizedSearch &&
    !filters.circularOnly &&
    !filters.orphanOnly &&
    !filters.unusedExportsOnly
  ) {
    return sourceNodes.map((node) => index.nodeById.get(node.id) ?? node);
  }

  const matchingIds = new Set<string>();
  for (const node of sourceNodes) {
    if (
      normalizedSearch &&
      (node.label.toLowerCase().includes(normalizedSearch) ||
        node.relativePath.toLowerCase().includes(normalizedSearch))
    )
      matchingIds.add(node.id);
    if (filters.circularOnly && index.circularNodeIds.has(node.id)) matchingIds.add(node.id);
    if (filters.orphanOnly && index.orphanNodeIds.has(node.id)) matchingIds.add(node.id);
    if (filters.unusedExportsOnly && index.unusedExportNodeIds.has(node.id))
      matchingIds.add(node.id);
  }
  const visibleIds =
    graphMode === 'structure' ? collectVisibleIds(matchingIds, index) : matchingIds;
  return sourceNodes
    .map((node) => index.nodeById.get(node.id) ?? node)
    .filter((node) => visibleIds.has(node.id));
}
