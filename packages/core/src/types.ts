// ============================================================================
// React Dependency Graph — Core Types
// ============================================================================
// All shared type definitions for the scanner, graph, and output formats.
// These types are consumed by the CLI and future integrations
// (MCP server, Antigravity, Codex).
// ============================================================================

// ─── Graph Data Structures ─────────────────────────────────────────────────

/**
 * A single node in the scanned folder/file tree.
 *
 * This structure is the source of truth for the project structure graph MVP.
 * Unlike dependency graph nodes, directories and files are both represented.
 */
export interface FileTreeNode {
  /** Unique identifier — the absolute path */
  id: string;

  /** Short display name (last path segment only) */
  name: string;

  /** Path relative to the scanned project root */
  relativePath: string;

  /** Absolute path on disk */
  absolutePath: string;

  /** Whether this node is a file or directory */
  kind: 'file' | 'directory';

  /** File extension for files, otherwise null */
  extension: string | null;

  /** Nesting depth from the root node */
  depth: number;

  /** Child nodes, only populated for directories */
  children: FileTreeNode[];

  /** File size in bytes, only populated for files */
  sizeBytes?: number;
}

/**
 * A node in the structure graph used by the browser UI.
 */
export interface StructureGraphNode {
  /** Unique identifier — the absolute path */
  id: string;

  /** Short label for display */
  label: string;

  /** Path relative to the scanned project root */
  relativePath: string;

  /** Absolute path on disk */
  absolutePath: string;

  /** Whether this node is a file or directory */
  kind: 'file' | 'directory';

  /** File extension for files, otherwise null */
  extension: string | null;

  /** Nesting depth from the root node */
  depth: number;

  /** Whether this directory is currently collapsed */
  collapsed: boolean;

  /** Whether this node is hidden because an ancestor is collapsed */
  hidden: boolean;

  /** Number of direct children */
  childCount: number;

  /** Total recursive descendant count */
  descendantCount: number;

  /** File size in bytes, only populated for files */
  sizeBytes?: number;
}

/**
 * A directed edge from a parent node to its child in the file tree.
 */
export interface StructureGraphEdge {
  /** Stable edge identifier */
  id: string;

  /** Parent node absolute path */
  source: string;

  /** Child node absolute path */
  target: string;
}

/**
 * The structure graph payload produced from a file tree.
 */
export interface StructureGraph {
  /** Root project directory */
  rootDir: string;

  /** Graph nodes for directories and files */
  nodes: StructureGraphNode[];

  /** Parent-to-child edges */
  edges: StructureGraphEdge[];
}

/**
 * A single file node in the dependency graph.
 *
 * Each scanned file becomes a GraphNode. The `id` is the absolute path,
 * which guarantees uniqueness. The `relativePath` is for display purposes.
 */
export interface GraphNode {
  /** Unique identifier — the absolute file path */
  id: string;

  /** Path relative to the project root (for display and portability) */
  relativePath: string;

  /** File extension: '.ts', '.tsx', '.js', or '.jsx' */
  extension: string;

  /** Number of files that import this file (incoming edges) */
  inDegree: number;

  /** Number of files this file imports (outgoing edges) */
  outDegree: number;

  /** Whether this file participates in a circular dependency */
  isCircular: boolean;

  /** Workspace/package this file belongs to in a monorepo */
  workspace?: string;

  /** Complexity and health metrics for this file */
  metrics?: FileMetrics;

  /** Detected component or export name (from default export, if any) */
  componentName?: string;

  /** Exported symbols from this file that are not used anywhere internally */
  unusedExports?: UnusedExport[];

  /** Imports in this file that could not be resolved to a local source file */
  unresolvedImports?: UnresolvedImport[];

  /** Namespaced metadata added by plugins */
  pluginData?: Record<string, unknown>;
}

/**
 * Per-file complexity and health metrics.
 */
export interface FileMetrics {
  /** Non-empty physical lines of code */
  loc: number;

  /** Cyclomatic complexity: decision points + 1 */
  cyclomaticComplexity: number;

  /** Number of export declarations/specifiers */
  exportCount: number;

  /** outDegree / (outDegree + inDegree), from 0 to 1 */
  instability: number;
}

/**
 * A directed edge representing an import relationship.
 *
 * The edge goes from `source` (the file that contains the import statement)
 * to `target` (the file being imported).
 */
export interface GraphEdge {
  /** Absolute path of the importing file */
  source: string;

  /** Absolute path of the imported file */
  target: string;

  /** The original import specifier as written in the source code */
  importSpecifier: string;

  /** List of named imports, e.g., ['useState', 'useEffect'] */
  importedNames: string[];

  /** Whether this is a type-only import (`import type { ... }`) */
  isTypeOnly: boolean;

  /** Whether this is a dynamic import (`import('...')`) */
  isDynamic: boolean;

  /** Whether this import crosses workspace/package boundaries */
  isCrossPackage?: boolean;

  /** Architecture rule violations attached to this import edge */
  ruleViolations?: RuleViolation[];

  /** Namespaced metadata added by plugins */
  pluginData?: Record<string, unknown>;
}

/**
 * A detected circular dependency chain.
 *
 * For example, if A imports B and B imports A, the chain would be:
 * ['A.tsx', 'B.tsx', 'A.tsx']
 */
export interface CircularChain {
  /** Ordered list of relative file paths forming the cycle */
  chain: string[];

  /** Human-readable description, e.g., "A.tsx → B.tsx → A.tsx" */
  description: string;
}

/**
 * The complete dependency graph for a project.
 */
export interface DependencyGraph {
  /** Absolute path of the scanned project root */
  rootDir: string;

  /** All file nodes in the graph */
  nodes: GraphNode[];

  /** All import edges in the graph */
  edges: GraphEdge[];

  /** All detected circular dependency chains */
  circularDependencies: CircularChain[];

  /** Metadata about the scan */
  metadata: ScanMetadata;

  /** Namespaced graph-level metadata added by plugins */
  pluginData?: Record<string, unknown>;
}

export type ImpactRiskLevel = 'low' | 'medium' | 'high';

export interface ImpactAnalysisOptions {
  /** Complexity score where a file becomes high-complexity */
  complexityThreshold?: number;

  /** Number of transitive dependents where a target file becomes high-impact */
  impactThreshold?: number;

  /** Number of incoming imports where an affected file becomes high-impact */
  inboundThreshold?: number;
}

export interface ImpactFileSummary {
  /** Path relative to the project root */
  file: string;

  /** Absolute file path */
  absolutePath: string;

  /** Shortest dependency distance from this file to the target */
  distance: number;

  /** Shortest path from this file to the target, using relative paths */
  path: string[];

  /** Number of files that import this file */
  inDegree: number;

  /** Number of files this file imports */
  outDegree: number;

  /** Complexity and health metrics for this file */
  metrics?: FileMetrics;

  /** Human-readable risk factors attached to this file */
  riskFactors: string[];

  /** Per-file impact risk */
  risk: ImpactRiskLevel;
}

export interface ImpactAnalysisResult {
  /** The file being analyzed */
  target: ImpactFileSummary;

  /** Files that directly import the target */
  directDependents: ImpactFileSummary[];

  /** Files that directly or transitively depend on the target */
  affectedFiles: ImpactFileSummary[];

  /** Number of direct dependents */
  directDependentCount: number;

  /** Number of direct and transitive dependents */
  affectedCount: number;

  /** Maximum shortest-path distance from an affected file to the target */
  maxDistance: number;

  /** Files that are both highly connected/impactful and complex */
  highImpactComplexFiles: ImpactFileSummary[];

  /** Overall change risk for the target file */
  risk: ImpactRiskLevel;

  /** Thresholds used by this analysis */
  thresholds: Required<ImpactAnalysisOptions>;
}

/**
 * A detected workspace package inside a monorepo.
 */
export interface WorkspaceInfo {
  /** Workspace display name, usually package.json name */
  name: string;

  /** Path relative to the project root */
  relativePath: string;

  /** Absolute workspace directory path */
  absolutePath: string;

  /** package.json exports map for modern Node package resolution */
  exports?: unknown;

  /** package.json imports map for package-local # aliases */
  imports?: unknown;
}

/**
 * Lightweight architecture import rule.
 *
 * A rule is treated as a forbidden import when a source path matching `from`
 * imports a target path matching `to`.
 */
export interface ArchitectureRule {
  /** Glob-like source path pattern */
  from?: string;

  /** Glob-like target path pattern */
  to?: string;

  /** Entry point patterns whose transitive dependency tree scopes this rule */
  entryPoints?: string[];

  /** Restricted files or modules for entry-point scoped rules */
  deny?: {
    files?: string[];
    modules?: string[];
  };

  /** Severity used by CLI validation and UI highlighting */
  severity?: 'error' | 'warning';

  /** Optional message shown when the rule is violated */
  message?: string;
}

/**
 * A dependency edge that violates an architecture rule.
 */
export interface RuleViolation {
  /** Source relative file path */
  source: string;

  /** Target relative file path */
  target: string;

  /** Original import specifier */
  importSpecifier: string;

  /** Rule source pattern */
  from: string;

  /** Rule target pattern */
  to: string;

  /** Entry point that scoped this rule, when applicable */
  entryPoint?: string;

  /** Violation severity */
  severity: 'error' | 'warning';

  /** Human-readable violation message */
  message: string;
}

export interface RuleValidationResult {
  violations: RuleViolation[];
  errorCount: number;
  warningCount: number;
}

export interface DevDependencyInProd {
  /** Production source file importing the devDependency */
  file: string;

  /** Imported devDependency package name */
  module: string;

  /** Original import specifier */
  importSpecifier: string;

  /** 1-based line number */
  line: number;

  /** Production entry point that reaches this file */
  entryPoint: string;

  /** Whether the import is type-only */
  isTypeOnly: boolean;
}

export interface ImportConventionConfig {
  /** Preferred style for internal source imports */
  prefer?: 'relative' | 'absolute';

  /** Alias prefix used when prefer is absolute */
  aliasPrefix?: string;

  /** Source-root path relative to project root for alias suggestions */
  root?: string;
}

export interface ImportConventionViolation {
  /** Source file containing the import */
  file: string;

  /** Target file if the import resolves internally */
  target: string;

  /** Original import specifier */
  importSpecifier: string;

  /** Suggested replacement import specifier */
  suggestedSpecifier: string;

  /** Expected convention */
  expected: 'relative' | 'absolute';

  /** 1-based line number */
  line: number;
}

export interface UnusedExport {
  /** Export name, or "default" for default exports */
  name: string;

  /** Export classification */
  kind: 'named' | 'default' | 'reexport';

  /** Whether this is a type-only export */
  isTypeOnly: boolean;

  /** 1-based source line number */
  line: number;
}

export interface UnresolvedImport {
  /** File relative path containing the unresolved import */
  file: string;

  /** Absolute source file path */
  absoluteFilePath: string;

  /** Import specifier as written in source */
  importSpecifier: string;

  /** 1-based source line number */
  line: number;

  /** Whether this import is type-only */
  isTypeOnly: boolean;

  /** Whether this import is dynamic */
  isDynamic: boolean;

  /** Optional resolution error details */
  error?: string;
}

// ─── Scan Configuration ────────────────────────────────────────────────────

/**
 * Options for configuring the scanner.
 *
 * All fields are optional and have sensible defaults.
 */
export interface ScanOptions {
  /** Absolute path to the project root directory (required) */
  rootDir: string;

  /**
   * File extensions to include in the scan.
   * @default ['.js', '.jsx', '.ts', '.tsx']
   */
  extensions?: string[];

  /**
   * Additional directory/file patterns to ignore (on top of defaults).
   * Uses glob-like matching against relative paths.
   */
  ignorePatterns?: string[];

  /**
   * Whether to detect circular dependencies.
   * @default true
   */
  detectCircular?: boolean;

  /**
   * Whether to resolve path aliases from tsconfig.json/jsconfig.json.
   * @default true
   */
  resolveAliases?: boolean;

  /**
   * Maximum depth for directory traversal.
   * @default Infinity
   */
  maxDepth?: number;

  /**
   * Whether to include type-only imports in the graph.
   * @default true
   */
  includeTypeImports?: boolean;

  /**
   * Whether to include dynamic imports (`import('...')`) in the graph.
   * @default true
   */
  includeDynamicImports?: boolean;

  /**
   * Patterns for known entry points to exclude from orphan detection.
   * Uses lightweight glob matching against relative paths.
   */
  entryPointPatterns?: string[];

  /**
   * Whether to compare package.json dependencies against imported packages.
   * @default false
   */
  detectUnusedDeps?: boolean;

  /** Architecture rules to validate against dependency edges */
  rules?: ArchitectureRule[];

  /** Production entry points used to detect devDependencies in production paths */
  prodEntryPoints?: string[];

  /** Development-only entry points excluded from production dependency checks */
  devEntryPoints?: string[];

  /** Whether type-only imports are ignored for devDependencies-in-production checks */
  ignoreTypeImports?: boolean;

  /** Optional internal import convention enforcement */
  importConventions?: ImportConventionConfig;

  /** Resolved plugins that can extend graph and scan results */
  plugins?: DepxrayPlugin[];
}

/**
 * Result of cross-referencing package.json dependencies with import specifiers.
 */
export interface UnusedDepsResult {
  /** Packages listed in package.json but not imported by scanned files */
  unused: string[];

  /** External packages imported by scanned files but not listed in package.json */
  unlisted: string[];
}

/**
 * Options for detecting files that have no incoming import edges.
 */
export interface OrphanDetectionOptions {
  /** Patterns for known entry points to exclude from orphan detection */
  entryPointPatterns?: string[];
}

/**
 * Options for scanning a raw folder/file tree.
 */
export interface ScanFileTreeOptions {
  /** Additional directory/file names to ignore */
  ignorePatterns?: string[];

  /**
   * Maximum child depth to traverse from the root node.
   * @default Infinity
   */
  maxDepth?: number;
}

/**
 * Persistent project configuration loaded from depxray.config.js,
 * depxray.config.mjs, .depxrayrc.json, or package.json's depxray key.
 */
export interface DepxrayConfig {
  /** Additional directory/file patterns to ignore */
  ignore?: string[];

  /** File extensions to include in dependency scans */
  extensions?: string[];

  /** Entry point glob patterns to exclude from orphan detection */
  entryPoints?: string[];

  /** Default graph mode for scan output and the browser UI */
  mode?: 'structure' | 'dependencies';

  /** Whether circular dependency detection is enabled */
  circular?: boolean;

  /** Whether tsconfig/jsconfig path alias resolution is enabled */
  aliases?: boolean;

  /** Preferred local browser server port */
  port?: number;

  /** Initial visible tree depth in the browser UI */
  depth?: number | 'all';

  /** Architecture rules for dependency validation */
  rules?: ArchitectureRule[];

  /** Production entry point patterns used by devDependency checks */
  prodEntryPoints?: string[];

  /** Development entry point patterns excluded from production checks */
  devEntryPoints?: string[];

  /** Ignore type-only imports when checking devDependencies in production */
  ignoreTypeImports?: boolean;

  /** Internal import convention enforcement */
  importConventions?: ImportConventionConfig;

  /** Plugin modules or inline plugin objects */
  plugins?: DepxrayPluginReference[];
}

export type MaybePromise<T> = T | Promise<T>;

export interface DepxrayPluginContext {
  /** Absolute path of the scanned project root */
  rootDir: string;
}

export interface DepxrayPlugin {
  /** Plugin display name used in errors and metadata */
  name?: string;

  /** Called after the dependency graph is built and annotated */
  afterBuildGraph?: (
    graph: DependencyGraph,
    context: DepxrayPluginContext,
  ) => MaybePromise<DependencyGraph | void>;

  /** Called before scanProject returns */
  afterScan?: (
    result: ScanResult,
    context: DepxrayPluginContext,
  ) => MaybePromise<ScanResult | void>;

  /** Called by report-producing integrations with their report data */
  onReport?: (
    data: unknown,
    context: DepxrayPluginContext,
  ) => MaybePromise<unknown | void>;
}

export type DepxrayPluginReference = string | DepxrayPlugin;

// ─── Scan Result ───────────────────────────────────────────────────────────

/**
 * The result returned by `scanProject()`.
 *
 * Contains the full dependency graph, summary statistics, and any errors
 * encountered during scanning.
 */
export interface ScanResult {
  /** The complete dependency graph */
  graph: DependencyGraph;

  /** Total number of files scanned */
  totalFiles: number;

  /** Total number of import edges found */
  totalImports: number;

  /** Total number of circular dependency chains */
  circularCount: number;

  /** Relative paths of files with no incoming imports, excluding entry points */
  orphanFiles: string[];

  /** Imports that could not be resolved to local source files */
  unresolvedImports: UnresolvedImport[];

  /** Optional npm dependency usage analysis */
  dependencyIssues?: UnusedDepsResult;

  /** Optional architecture rule validation result */
  ruleValidation?: RuleValidationResult;

  /** Optional devDependencies imported from production dependency trees */
  devDepsInProd?: DevDependencyInProd[];

  /** Optional import convention violations */
  importConventionViolations?: ImportConventionViolation[];

  /** Namespaced scan-level metadata added by plugins */
  pluginData?: Record<string, unknown>;

  /** Files that could not be parsed, with error details */
  errors: ScanError[];

  /** How long the scan took in milliseconds */
  durationMs: number;
}

/**
 * A file that failed to parse during scanning.
 */
export interface ScanError {
  /** Absolute path of the file that failed */
  filePath: string;

  /** Human-readable error message */
  error: string;
}

/**
 * Metadata about a scan, included in the graph and exported JSON.
 */
export interface ScanMetadata {
  /** ISO 8601 timestamp of when the scan was performed */
  scannedAt: string;

  /** How long the scan took in milliseconds */
  scanDurationMs: number;

  /** Absolute path of the project root */
  projectRoot: string;

  /** Total number of files in the graph */
  totalFiles: number;

  /** Total number of edges in the graph */
  totalEdges: number;

  /** Number of circular dependency chains detected */
  circularCount: number;

  /** Version of @depxray/core that produced this graph */
  depxrayVersion: string;
}

// ─── Internal Types (used within core, but exported for extensibility) ─────

/**
 * Raw import information extracted from a single file's AST.
 * This is an intermediate representation before path resolution.
 */
export interface RawImportInfo {
  /** The import specifier as written in source, e.g., './Button' or '@/utils' */
  source: string;

  /** Named imports: ['Button', 'ButtonProps'] */
  specifiers: string[];

  /** Export names referenced from the target module */
  referencedExports?: string[];

  /** Whether this is `import type { ... }` */
  isTypeOnly: boolean;

  /** Whether this is a dynamic `import('...')` */
  isDynamic: boolean;

  /** Line number in the source file */
  line: number;

  /** AST construct that created this dependency */
  originKind?: 'import' | 'reexport_named' | 'reexport_all' | 'dynamic' | 'require';
}

export interface RawExportInfo {
  /** Export name visible from this module */
  name: string;

  /** Export classification */
  kind: 'named' | 'default' | 'reexport' | 'export_all';

  /** Whether this is a type-only export */
  isTypeOnly: boolean;

  /** 1-based source line number */
  line: number;

  /** Re-export source specifier if this export comes from another module */
  source?: string;

  /** Original export name from the source module for re-exports */
  sourceExportName?: string;
}

/**
 * A resolved import — the raw import after path resolution.
 */
export interface ResolvedImport {
  /** The original raw import info */
  raw: RawImportInfo;

  /** The resolved absolute file path, or null if unresolvable */
  resolvedPath: string | null;

  /** Why the import couldn't be resolved (if resolvedPath is null) */
  error?: string;
}

/**
 * A path alias mapping loaded from tsconfig.json or jsconfig.json.
 *
 * Example: `"@/*": ["./src/*"]` becomes:
 *   { prefix: '@/', paths: ['/abs/path/to/src/'] }
 */
export interface AliasMapping {
  /** The alias prefix (without the wildcard `*`), e.g., '@/' */
  prefix: string;

  /** Absolute directory paths this alias maps to */
  paths: string[];
}

/**
 * Default directories and patterns to ignore during file discovery.
 */
export const DEFAULT_IGNORE_PATTERNS: string[] = [
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.git',
  '.cache',
  '.turbo',
  '.depxray',
  '__mocks__',
];

/**
 * Default file extensions to scan.
 */
export const DEFAULT_EXTENSIONS: string[] = ['.js', '.jsx', '.ts', '.tsx'];

/**
 * Default entry points excluded from orphan detection.
 */
export const DEFAULT_ENTRY_POINT_PATTERNS: string[] = [
  '**/index.*',
  '**/main.*',
  '**/app.*',
  '**/App.*',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.config.*',
  '**/vite.config.*',
  '**/next.config.*',
];
