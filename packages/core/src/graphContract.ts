import type { HealthScoreResult } from './computeHealthScore.js';
import type {
  ScanError,
  ScanResult,
  StructureGraphEdge,
  StructureGraphNode,
} from './types.js';

export const GRAPH_PAYLOAD_SCHEMA_VERSION = '1.0.0';

export type ExplorerGraphMode = 'structure' | 'dependencies';

export interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  componentName?: string;
  workspace?: string;
  metrics?: ScanResult['graph']['nodes'][number]['metrics'];
  unusedExports?: ScanResult['graph']['nodes'][number]['unusedExports'];
  unresolvedImports?: ScanResult['graph']['nodes'][number]['unresolvedImports'];
  pluginData?: Record<string, unknown>;
}

export interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: ExplorerGraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
  isCrossPackage?: boolean;
  ruleViolations?: ScanResult['graph']['edges'][number]['ruleViolations'];
  pluginData?: Record<string, unknown>;
}

export interface ExplorerGraphData {
  schemaVersion: typeof GRAPH_PAYLOAD_SCHEMA_VERSION;
  mode: ExplorerGraphMode;
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  circularDependencies: ScanResult['graph']['circularDependencies'];
  orphanFiles: string[];
  unresolvedImports: ScanResult['unresolvedImports'];
  dependencyIssues?: ScanResult['dependencyIssues'];
  ruleValidation?: ScanResult['ruleValidation'];
  devDepsInProd?: ScanResult['devDepsInProd'];
  importConventionViolations?: ScanResult['importConventionViolations'];
  healthScore?: HealthScoreResult;
  pluginData?: Record<string, unknown>;
  generatedBy: string;
  errors: ScanError[];
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

export interface ExplorerGraphSet {
  schemaVersion: typeof GRAPH_PAYLOAD_SCHEMA_VERSION;
  generatedBy: string;
  projectRoot: string;
  scannedAt: string;
  availableModes: ExplorerGraphMode[];
  defaultMode: ExplorerGraphMode;
  graphs: Partial<Record<ExplorerGraphMode, ExplorerGraphData>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertExplorerGraphData(value: unknown): asserts value is ExplorerGraphData {
  if (!isRecord(value)) {
    throw new Error('Invalid depxray graph payload: expected an object.');
  }
  if (value.schemaVersion !== GRAPH_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unsupported depxray graph schema: ${String(value.schemaVersion)}.`);
  }
  if (value.mode !== 'structure' && value.mode !== 'dependencies') {
    throw new Error(`Invalid depxray graph mode: ${String(value.mode)}.`);
  }
  if (typeof value.projectRoot !== 'string' || typeof value.generatedBy !== 'string') {
    throw new Error('Invalid depxray graph payload: missing project metadata.');
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error('Invalid depxray graph payload: nodes and edges must be arrays.');
  }
}

export function assertExplorerGraphSet(value: unknown): asserts value is ExplorerGraphSet {
  if (!isRecord(value)) {
    throw new Error('Invalid depxray graph set: expected an object.');
  }
  if (value.schemaVersion !== GRAPH_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unsupported depxray graph-set schema: ${String(value.schemaVersion)}.`);
  }
  if (!isRecord(value.graphs) || !Array.isArray(value.availableModes)) {
    throw new Error('Invalid depxray graph set: missing graph collection.');
  }
  if (value.defaultMode !== 'structure' && value.defaultMode !== 'dependencies') {
    throw new Error(`Invalid depxray graph-set mode: ${String(value.defaultMode)}.`);
  }
  for (const mode of ['structure', 'dependencies'] as const) {
    if (value.graphs[mode] !== undefined) {
      assertExplorerGraphData(value.graphs[mode]);
    }
  }
}
