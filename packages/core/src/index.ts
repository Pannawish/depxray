// ============================================================================
// @depxray/core — Public API
// ============================================================================
// Barrel export file. Everything exported here is the public API of the
// core scanner package. Keep this minimal and intentional.
// ============================================================================

// ─── Main API ──────────────────────────────────────────────────────────────
export { scanProject } from './scanProject.js';
export { ProjectScanSession } from './ProjectScanSession.js';
export type { ScanSessionStats } from './ProjectScanSession.js';
export { exportGraphJSON } from './exportGraph.js';
export { scanFileTree } from './scanFileTree.js';
export { filterTreeByDepth } from './filterTreeByDepth.js';
export { buildStructureGraph } from './buildStructureGraph.js';
export { parseExports } from './parseExports.js';
export { analyzeImpact } from './analyzeImpact.js';
export { computeHealthScore } from './computeHealthScore.js';
export { findDependencyChain } from './findDependencyChain.js';
export {
  assertExplorerGraphData,
  assertExplorerGraphSet,
  GRAPH_PAYLOAD_SCHEMA_VERSION,
} from './graphContract.js';
export {
  createDependencyGraphPayload,
  createStructureGraphPayload,
} from './graphPayload.js';
export type { HealthScoreResult } from './computeHealthScore.js';
export type { DependencyChainResult } from './findDependencyChain.js';
export type {
  ExplorerGraphData,
  ExplorerGraphEdge,
  ExplorerGraphMode,
  ExplorerGraphNode,
  ExplorerGraphSet,
} from './graphContract.js';
export type { GraphPayloadOptions } from './graphPayload.js';

// ─── Individual modules (for advanced usage) ──────────────────────────────
export { parseImports } from './parseImports.js';
export { resolveImport, resolveImports } from './resolveImports.js';
export { buildGraph } from './buildGraph.js';
export { detectCircularDeps } from './detectCircularDeps.js';
export { detectUnusedExports } from './detectUnusedExports.js';
export { detectProjectEntryPointPatterns } from './detectProjectEntryPoints.js';
export { detectOrphanFiles, matchesAnyPattern } from './detectOrphanFiles.js';
export { detectUnusedDeps } from './detectUnusedDeps.js';
export {
  createWorkspaceAliases,
  detectWorkspaces,
  getWorkspaceForPath,
} from './detectWorkspaces.js';
export { attachRuleViolations, validateRules } from './validateRules.js';
export { diffGraphs } from './diffGraphs.js';
export type { GraphDiffEdge, GraphDiffResult } from './diffGraphs.js';
export { discoverFiles } from './fileDiscovery.js';
export { loadAliases } from './configLoader.js';
export { loadConfig } from './loadConfig.js';
export { computeFileMetrics } from './computeMetrics.js';
export {
  BUILT_IN_PLUGINS,
  complexityPlugin,
  githubPrPlugin,
  mcpPlugin,
  runAfterBuildGraphHooks,
  runAfterScanHooks,
  runReportHooks,
} from './plugins.js';

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  FileTreeNode,
  GraphNode,
  GraphEdge,
  FileMetrics,
  RawExportInfo,
  UnusedDepsResult,
  UnusedExport,
  UnresolvedImport,
  DevDependencyInProd,
  ImportConventionConfig,
  ImportConventionViolation,
  ImpactAnalysisOptions,
  ImpactAnalysisResult,
  ImpactFileSummary,
  ImpactRiskLevel,
  WorkspaceInfo,
  ArchitectureRule,
  DepxrayPlugin,
  DepxrayPluginContext,
  DepxrayPluginReference,
  RuleValidationResult,
  RuleViolation,
  StructureGraphNode,
  StructureGraphEdge,
  StructureGraph,
  CircularChain,
  DependencyGraph,
  MaybePromise,
  ScanOptions,
  ScanAnalysisCache,
  ScanAnalysisCacheEntry,
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
