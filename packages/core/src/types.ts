// ============================================================================
// React Dependency Graph — Core Types
// ============================================================================
// All shared type definitions for the scanner, graph, and output formats.
// These types are consumed by the CLI, VS Code extension, and future
// integrations (MCP server, Antigravity, Codex).
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

  /** Detected component or export name (from default export, if any) */
  componentName?: string;
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

  /** Version of @rdg/core that produced this graph */
  rdgVersion: string;
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

  /** Whether this is `import type { ... }` */
  isTypeOnly: boolean;

  /** Whether this is a dynamic `import('...')` */
  isDynamic: boolean;

  /** Line number in the source file */
  line: number;
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
  '.react-dependency-graph',
  '__mocks__',
];

/**
 * Default file extensions to scan.
 */
export const DEFAULT_EXTENSIONS: string[] = ['.js', '.jsx', '.ts', '.tsx'];
