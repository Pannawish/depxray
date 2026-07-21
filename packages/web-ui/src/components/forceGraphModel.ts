import type { ExplorerGraphEdge, GraphMode, GraphScopeNodeRole } from '../types.js';

export interface ForceGraphNode {
  id: string;
  label: string;
  relativePath: string;
  extension: string | null;
  kind: 'file' | 'directory';
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  workspace?: string;
  complexity?: number;
  sizeBytes?: number;
  instability?: number;
  unusedExportsCount?: number;
  unresolvedImportsCount?: number;
  isImpacted?: boolean;
  isImpactTarget?: boolean;
  scopeRole?: GraphScopeNodeRole;
  memberCount?: number;
  internalEdgeCount?: number;
  isDependencyPath?: boolean;
  isDependencyPathTarget?: boolean;
  x?: number;
  y?: number;
}

export interface ForceGraphLink {
  source: string;
  target: string;
  kind: GraphMode;
  importSpecifier?: string;
  circular: boolean;
  typeOnly?: boolean;
  dynamic?: boolean;
  crossPackage?: boolean;
  ruleSeverity?: 'error' | 'warning';
  isImpactPath?: boolean;
  isDependencyPath?: boolean;
  scopeRole?: ExplorerGraphEdge['scopeRole'];
  aggregateCount?: number;
  memberEdgeIds?: string[];
}

export interface NodeContextMenu {
  node: ForceGraphNode;
  x: number;
  y: number;
}

export interface LabelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
