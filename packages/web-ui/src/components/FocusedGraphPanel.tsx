import { GraphView } from './GraphView.js';
import {
  filterDependencyEdges,
  type FileRelationshipIndex,
  type FolderSummary,
} from '../relationshipIndex.js';
import type {
  DependencyFilters,
  ExplorerGraphEdge,
  ExplorerGraphNode,
} from '../types.js';

interface FocusedGraphPanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  folderSummary: FolderSummary | null;
  filters: DependencyFilters;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

const MAX_FOCUSED_NODES = 80;

function uniqueEdges(edges: ExplorerGraphEdge[]): ExplorerGraphEdge[] {
  const seen = new Set<string>();
  const result: ExplorerGraphEdge[] = [];

  for (const edge of edges) {
    if (seen.has(edge.id)) {
      continue;
    }

    seen.add(edge.id);
    result.push(edge);
  }

  return result;
}

function buildFocusedGraph(
  node: ExplorerGraphNode,
  index: FileRelationshipIndex,
  folderSummary: FolderSummary | null,
  filters: DependencyFilters,
): { nodes: ExplorerGraphNode[]; edges: ExplorerGraphEdge[]; skipped: boolean } {
  const filteredDependencyEdges = filterDependencyEdges(index.dependencyEdges, filters);
  const nodeIds = new Set<string>([node.id]);
  let edges: ExplorerGraphEdge[] = [];

  if (filters.circularOnly) {
    for (const circularNodeId of index.circularNodeIds) {
      nodeIds.add(circularNodeId);
    }
    edges = filteredDependencyEdges.filter((edge) => (
      index.circularNodeIds.has(edge.source) && index.circularNodeIds.has(edge.target)
    ));
  } else if (node.kind === 'directory') {
    const fileIds = new Set(index.filesByFolderId.get(node.id) ?? []);
    for (const fileId of fileIds) {
      nodeIds.add(fileId);
    }
    edges = uniqueEdges([
      ...(folderSummary?.internalImports ?? []),
      ...(folderSummary?.incomingExternal ?? []),
      ...(folderSummary?.outgoingExternal ?? []),
    ]);
    for (const edge of edges) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  } else {
    edges = uniqueEdges([
      ...(index.importsBySourceId.get(node.id) ?? []),
      ...(index.importedByTargetId.get(node.id) ?? []),
    ]);
    edges = filterDependencyEdges(edges, filters);
    for (const edge of edges) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  const nodes = Array.from(nodeIds)
    .map((nodeId) => index.nodeById.get(nodeId))
    .filter((item): item is ExplorerGraphNode => Boolean(item))
    .slice(0, MAX_FOCUSED_NODES);
  const visibleNodeIds = new Set(nodes.map((item) => item.id));

  return {
    nodes,
    edges: edges.filter((edge) => (
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    )),
    skipped: nodeIds.size > MAX_FOCUSED_NODES,
  };
}

export function FocusedGraphPanel({
  node,
  index,
  folderSummary,
  filters,
  selectedNodeId,
  onSelectNode,
}: FocusedGraphPanelProps) {
  if (!node) {
    return null;
  }

  const focusedGraph = buildFocusedGraph(node, index, folderSummary, filters);
  if (!focusedGraph.nodes.length) {
    return null;
  }

  return (
    <section className="focused-graph-panel">
      <div className="panel-header inline">
        <div>
          <p className="eyebrow">Focused graph</p>
          <h2>{focusedGraph.nodes.length} files</h2>
        </div>
        {focusedGraph.skipped ? (
          <span className="graph-limit">showing first {MAX_FOCUSED_NODES}</span>
        ) : null}
      </div>
      <div className="focused-graph-shell">
        <GraphView
          mode="dependencies"
          nodes={focusedGraph.nodes}
          edges={focusedGraph.edges}
          matchedNodeIds={new Set()}
          emphasizedNodeIds={new Set(focusedGraph.nodes.map((item) => item.id))}
          selectedNodeId={selectedNodeId}
          fitViewNonce={focusedGraph.nodes.length + focusedGraph.edges.length}
          onSelectNode={onSelectNode}
          onToggleNode={() => undefined}
        />
      </div>
    </section>
  );
}
