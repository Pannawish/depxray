import type {
  GraphEdge as DependencyGraphEdge,
  GraphNode as DependencyGraphNode,
  StructureGraphEdge,
  StructureGraphNode,
  UnresolvedImport,
  RuleValidationResult,
  HealthScoreResult,
} from '@depxray/core';

export type {
  DependencyGraphEdge,
  DependencyGraphNode,
  StructureGraphEdge,
  StructureGraphNode,
} from '@depxray/core';

export type DepthFilter = 1 | 2 | 3 | 4 | 'all';
export type GraphMode = 'structure' | 'dependencies';
export type GraphScopeMode = 'project' | 'folder' | 'file';
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

export interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  componentName?: string;
  workspace?: DependencyGraphNode['workspace'];
  metrics?: DependencyGraphNode['metrics'];
  unusedExports?: DependencyGraphNode['unusedExports'];
  unresolvedImports?: DependencyGraphNode['unresolvedImports'];
  pluginData?: DependencyGraphNode['pluginData'];
  scopeRole?: GraphScopeNodeRole;
  memberNodeIds?: string[];
  memberCount?: number;
  internalEdgeCount?: number;
}

export interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: GraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
  isCrossPackage?: DependencyGraphEdge['isCrossPackage'];
  ruleViolations?: DependencyGraphEdge['ruleViolations'];
  pluginData?: DependencyGraphEdge['pluginData'];
  scopeRole?: GraphScopeEdgeRole;
  aggregateCount?: number;
  memberEdgeIds?: string[];
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
  circularDependencies: Array<{ chain: string[]; description: string }>;
  orphanFiles: string[];
  unresolvedImports: UnresolvedImport[];
  dependencyIssues?: {
    unused: string[];
    unlisted: string[];
  };
  ruleValidation?: RuleValidationResult;
  devDepsInProd?: Array<{
    file: string;
    module: string;
    importSpecifier: string;
    line: number;
    entryPoint: string;
    isTypeOnly: boolean;
  }>;
  importConventionViolations?: Array<{
    file: string;
    target: string;
    importSpecifier: string;
    suggestedSpecifier: string;
    expected: 'relative' | 'absolute';
    line: number;
  }>;
  healthScore?: HealthScoreResult;
  pluginData?: Record<string, unknown>;
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
