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
export { discoverFiles } from './fileDiscovery.js';
export { loadAliases } from './configLoader.js';

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  FileTreeNode,
  GraphNode,
  GraphEdge,
  StructureGraphNode,
  StructureGraphEdge,
  StructureGraph,
  CircularChain,
  DependencyGraph,
  ScanOptions,
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
  DEFAULT_IGNORE_PATTERNS,
} from './types.js';
