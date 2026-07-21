import type {
  ExplorerGraphData as CoreExplorerGraphData,
  ExplorerGraphEdge as CoreExplorerGraphEdge,
  ExplorerGraphMode,
  ExplorerGraphNode as CoreExplorerGraphNode,
  ExplorerGraphSet as CoreExplorerGraphSet,
  GraphEdge,
  GraphNode,
} from '@depxray/core';

export type { StructureGraphEdge, StructureGraphNode } from '@depxray/core';

export type DependencyGraphEdge = GraphEdge;
export type DependencyGraphNode = GraphNode;

export type DepthFilter = 1 | 2 | 3 | 4 | 'all';
export type GraphMode = ExplorerGraphMode;
export type GraphScopeMode = 'project' | 'folder' | 'file';
export type GraphPreset = 'overview' | 'direct' | 'full' | 'circular' | 'violations' | 'impact';
export type FileNeighborhoodDepth = 1 | 2 | 'all';
export type FolderBoundaryMode = 'all' | 'internal' | 'incoming' | 'outgoing';
export type GraphScopeNodeRole =
  | 'focus'
  | 'import'
  | 'dependent'
  | 'related'
  | 'internal'
  | 'external-incoming'
  | 'external-outgoing'
  | 'external-both';
export type GraphScopeEdgeRole = 'dependency' | 'internal' | 'incoming' | 'outgoing' | 'membership';

export interface ExplorerGraphNode extends CoreExplorerGraphNode {
  scopeRole?: GraphScopeNodeRole;
  memberNodeIds?: string[];
  memberCount?: number;
  internalEdgeCount?: number;
}

export interface ExplorerGraphEdge extends CoreExplorerGraphEdge {
  scopeRole?: GraphScopeEdgeRole;
  aggregateCount?: number;
  memberEdgeIds?: string[];
}

export interface ExplorerGraphData extends Omit<CoreExplorerGraphData, 'nodes' | 'edges'> {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

export interface ExplorerGraphSet extends Omit<CoreExplorerGraphSet, 'graphs'> {
  graphs: Partial<Record<GraphMode, ExplorerGraphData>>;
}

export interface DependencyFilters {
  showTypeOnlyEdges: boolean;
  showDynamicEdges: boolean;
  circularOnly: boolean;
  orphanOnly: boolean;
  unusedExportsOnly?: boolean;
}

declare global {
  interface Window {
    __GRAPH_DATA__?: ExplorerGraphData;
    __GRAPH_DATA_SET__?: ExplorerGraphSet;
    __DEPXRAY_INITIAL_DEPTH__?: DepthFilter;
    __DEPXRAY_INITIAL_MODE__?: GraphMode;
  }
}
