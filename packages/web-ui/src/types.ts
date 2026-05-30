import type {
  GraphEdge as DependencyGraphEdge,
  GraphNode as DependencyGraphNode,
  StructureGraphEdge,
  StructureGraphNode,
} from '@rdg/core';

export type {
  DependencyGraphEdge,
  DependencyGraphNode,
  StructureGraphEdge,
  StructureGraphNode,
} from '@rdg/core';

export type DepthFilter = 1 | 2 | 3 | 4 | 'all';
export type GraphMode = 'structure' | 'dependencies';

export interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  componentName?: string;
}

export interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: GraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
}

export interface ExplorerGraphData {
  schemaVersion: string;
  mode: GraphMode;
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  generatedBy: string;
  errors: Array<{ filePath: string; error: string }>;
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

declare global {
  interface Window {
    __GRAPH_DATA__?: ExplorerGraphData;
    __RDG_INITIAL_DEPTH__?: DepthFilter;
  }
}
