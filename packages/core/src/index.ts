// ============================================================================
// @depxray/core — Public API
// ============================================================================
// Barrel export file. Everything exported here is the public API of the
// core scanner package. Keep this minimal and intentional.
// ============================================================================

// ─── Main API ──────────────────────────────────────────────────────────────
export { scanProject } from './scanProject.js';
export { exportGraphJSON } from './exportGraph.js';
export { scanFileTree } from './scanFileTree.js';
export { filterTreeByDepth } from './filterTreeByDepth.js';
export { buildStructureGraph } from './buildStructureGraph.js';

// ─── Individual modules (for advanced usage) ──────────────────────────────
export { parseImports } from './parseImports.js';
export { resolveImport, resolveImports } from './resolveImports.js';
export { buildGraph } from './buildGraph.js';
export { detectCircularDeps } from './detectCircularDeps.js';
export { detectOrphanFiles, matchesAnyPattern } from './detectOrphanFiles.js';
export { detectUnusedDeps } from './detectUnusedDeps.js';
export {
  createWorkspaceAliases,
  detectWorkspaces,
  getWorkspaceForPath,
} from './detectWorkspaces.js';
export { discoverFiles } from './fileDiscovery.js';
export { loadAliases } from './configLoader.js';
export { loadConfig } from './loadConfig.js';
export { computeFileMetrics } from './computeMetrics.js';

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  FileTreeNode,
  GraphNode,
  GraphEdge,
  FileMetrics,
  UnusedDepsResult,
  WorkspaceInfo,
  StructureGraphNode,
  StructureGraphEdge,
  StructureGraph,
  CircularChain,
  DependencyGraph,
  ScanOptions,
  DepxrayConfig,
  OrphanDetectionOptions,
  ScanFileTreeOptions,
  ScanResult,
  ScanError,
  ScanMetadata,
  RawImportInfo,
  ResolvedImport,
  AliasMapping,
} from './types.js';

// ─── Constants ─────────────────────────────────────────────────────────────
export {
  DEFAULT_EXTENSIONS,
  DEFAULT_ENTRY_POINT_PATTERNS,
  DEFAULT_IGNORE_PATTERNS,
} from './types.js';
