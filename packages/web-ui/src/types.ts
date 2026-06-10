import type {
  GraphEdge as DependencyGraphEdge,
  GraphNode as DependencyGraphNode,
  StructureGraphEdge,
  StructureGraphNode,
} from '@depxray/core';

export type {
  DependencyGraphEdge,
  DependencyGraphNode,
  StructureGraphEdge,
  StructureGraphNode,
} from '@depxray/core';

export type DepthFilter = 1 | 2 | 3 | 4 | 'all';
export type GraphMode = 'structure' | 'dependencies';

export interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  componentName?: string;
  workspace?: DependencyGraphNode['workspace'];
  metrics?: DependencyGraphNode['metrics'];
}

export interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: GraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
  isCrossPackage?: DependencyGraphEdge['isCrossPackage'];
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
  orphanFiles: string[];
  generatedBy: string;
  errors: Array<{ filePath: string; error: string }>;
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

export interface ExplorerGraphSet {
  schemaVersion: string;
  generatedBy: string;
  projectRoot: string;
  scannedAt: string;
  availableModes: GraphMode[];
  defaultMode: GraphMode;
  graphs: Partial<Record<GraphMode, ExplorerGraphData>>;
}

export interface DependencyFilters {
  showTypeOnlyEdges: boolean;
  showDynamicEdges: boolean;
  circularOnly: boolean;
  orphanOnly: boolean;
}

declare global {
  interface Window {
    __GRAPH_DATA__?: ExplorerGraphData;
    __GRAPH_DATA_SET__?: ExplorerGraphSet;
    __DEPXRAY_INITIAL_DEPTH__?: DepthFilter;
    __DEPXRAY_INITIAL_MODE__?: GraphMode;
  }
}
