# depxray — Competitive Analysis & Agent-Ready Implementation Specs

> **Purpose**: This document serves two roles:
> 1. Strategic analysis of where depxray stands vs competitors
> 2. Self-contained implementation specs that an AI coding agent (Codex, Claude, etc.) can pick up and execute directly
>
> Each feature spec includes: codebase context, exact file paths, interfaces, implementation steps, and acceptance criteria.

---

## Implementation Status

This document is a planning and competitive-analysis record. The checked implementation state for release preparation is:

- Implemented through v2.0.0: Features 1-12 and 14.
- Not implemented here: Feature 13, the VS Code extension.
- Some code snippets and unchecked acceptance boxes below are the original implementation specs, not the latest source-of-truth API. Use `README.md`, package READMEs, and the current `packages/*/src` files for release-facing behavior.

---

## Codebase Architecture Context

> **An AI agent MUST read this section before implementing any feature.**

### Monorepo Structure

```
depxray/                          # Root — npm workspaces monorepo
├── packages/
│   ├── core/                     # @depxray/core — scanner & analysis engine
│   │   └── src/
│   │       ├── index.ts          # Barrel exports (public API)
│   │       ├── types.ts          # ALL shared types (GraphNode, GraphEdge, etc.)
│   │       ├── scanProject.ts    # Main entry: orchestrates full scan pipeline
│   │       ├── parseImports.ts   # Babel AST → RawImportInfo[]
│   │       ├── resolveImports.ts # RawImportInfo → ResolvedImport[]
│   │       ├── buildGraph.ts     # ResolvedImport[] → DependencyGraph
│   │       ├── detectCircularDeps.ts  # Circular chain detection (DFS)
│   │       ├── scanFileTree.ts   # File tree scanner → FileTreeNode
│   │       ├── buildStructureGraph.ts # FileTreeNode → StructureGraph
│   │       ├── configLoader.ts   # tsconfig.json alias loading
│   │       ├── fileDiscovery.ts  # Recursive file finder with ignore patterns
│   │       ├── exportGraph.ts    # JSON serializer
│   │       └── filterTreeByDepth.ts
│   ├── cli/                      # depxray — published npm package
│   │   └── src/
│   │       ├── index.ts          # CLI entry point (Commander.js)
│   │       ├── commands/
│   │       │   ├── scan.ts       # `depxray scan` — main command (660 lines)
│   │       │   └── inspect.ts    # `depxray inspect` — single file
│   │       └── formatters/
│   │           ├── text.ts       # Human-readable inspect output
│   │           ├── json.ts       # JSON inspect output
│   │           └── dot.ts        # DOT format output
│   └── web-ui/                   # @depxray/web-ui — React browser UI (Vite)
│       └── src/
│           ├── App.tsx           # Main app shell (3-panel layout)
│           ├── main.tsx          # React entry
│           ├── styles.css        # All CSS (19KB)
│           ├── types.ts          # UI-specific types
│           ├── relationshipIndex.ts  # Graph data indexing/querying
│           ├── hooks/
│           │   └── useGraphData.ts   # Fetches data from server/window
│           └── components/
│               ├── ExplorerToolbar.tsx   # Top bar with search, stats, filters
│               ├── FileTreeView.tsx      # Left panel: collapsible file tree
│               ├── MillerColumnsPanel.tsx # Center panel: dependency drill-down
│               ├── FileCodeViewer.tsx     # Right panel: inline source code
│               ├── SelectionPanel.tsx     # Right panel: file/folder details
│               ├── SearchBox.tsx
│               ├── SidePanel.tsx
│               └── Toolbar.tsx
├── package.json                  # Root workspace config
├── tsconfig.base.json
└── scripts/
    └── sync-versions.mjs         # Keeps package versions aligned
```

### Key Patterns & Conventions

1. **Dependencies**: `@depxray/core` uses `@babel/parser`, `@babel/traverse`, `@babel/types`. CLI uses `commander`, `esbuild`. Web UI uses React + Vite.
2. **Build**: `tsc` for core, `esbuild` bundles CLI, Vite builds web-ui → bundled into CLI's `dist/web-ui/`.
3. **CLI serves web UI**: `scan.ts` starts an HTTP server serving the built web-ui files + API endpoints (`/api/graph-set`, `/api/graph-data`, `/api/tree`, `/api/file`).
4. **Data flow**: `scanProject()` → `ScanResult` → `toDependencyGraphData()` → `ExplorerGraphData` → sent to browser via HTTP or injected into HTML.
5. **Tests**: Vitest. Test files in `__tests__/` directories.
6. **All types are in `packages/core/src/types.ts`**. The web-ui has its own minimal `types.ts` for UI-specific types.

### Critical Type Interfaces (in `packages/core/src/types.ts`)

```typescript
interface GraphNode {
  id: string;              // Absolute file path
  relativePath: string;
  extension: string;
  inDegree: number;        // Files that import this file
  outDegree: number;       // Files this file imports
  isCircular: boolean;
  componentName?: string;
}

interface GraphEdge {
  source: string;          // Importing file path
  target: string;          // Imported file path
  importSpecifier: string; // Original import string
  importedNames: string[];
  isTypeOnly: boolean;
  isDynamic: boolean;
}

interface DependencyGraph {
  rootDir: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  circularDependencies: CircularChain[];
  metadata: ScanMetadata;
}

interface ScanResult {
  graph: DependencyGraph;
  totalFiles: number;
  totalImports: number;
  circularCount: number;
  errors: ScanError[];
  durationMs: number;
}
```

### CLI ExplorerGraphData (in `packages/cli/src/commands/scan.ts`)

```typescript
// This is the shape sent to the browser UI and JSON output
interface ExplorerGraphData {
  schemaVersion: string;
  mode: 'structure' | 'dependencies';
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  generatedBy: string;
  errors: ScanError[];
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}
```

---

## Competitive Landscape Summary

| Tool | Stars | Key Strength | Key Weakness |
| :--- | :--- | :--- | :--- |
| **madge** (~10.1k ⭐) | Quick viz | Static Graphviz images only, no interactive UI |
| **dependency-cruiser** (~6.7k ⭐) | Rule engine for CI | Complex config, no browser UI |
| **skott** (~0.9k ⭐) | Programmatic API, watch mode | Basic web app, smaller community |
| **knip** (growing) | Unused code/deps detection | Different focus (linting, not visualization) |

### depxray v1.0.0 Existing Strengths
- ✅ Best-in-class interactive browser UI (3-panel, resizable, Miller columns)
- ✅ Dual-mode scanning (structure + dependencies)
- ✅ Static HTML export (self-contained, shareable)
- ✅ AI agent-ready JSON output
- ✅ Zero-config `npx depxray scan`

---

## Feature Specs — Tier 1 (Highest Impact)

---

### FEATURE 1: Orphan/Unused File Detection

**Priority**: 🔴 HIGH — Low effort, high value. All data already exists.

**Competitive gap**: madge has `--orphans`, skott finds unused files. depxray does not.

#### Overview
Detect files with zero incoming edges (no other file imports them). These are potential dead code. Exclude configurable entry points.

#### Files to Modify

**`packages/core/src/types.ts`** — Add new types:
```typescript
interface OrphanDetectionOptions {
  /** Patterns for known entry points to exclude from orphan detection */
  entryPointPatterns?: string[];
}

// Add to ScanResult:
interface ScanResult {
  // ... existing fields ...
  orphanFiles: string[];  // NEW: relative paths of orphan files
}
```

**`packages/core/src/scanProject.ts`** — Add orphan detection after graph building:
```typescript
// After step 6 (circular detection), add step 7:
// Step 7: Detect orphan files
const entryPointPatterns = options.entryPointPatterns ?? [
  '**/index.*', '**/main.*', '**/app.*', '**/App.*',
  '**/*.test.*', '**/*.spec.*', '**/*.config.*',
  '**/vite.config.*', '**/next.config.*',
];
const orphanFiles = graph.nodes
  .filter(node => node.inDegree === 0)
  .filter(node => !matchesAnyPattern(node.relativePath, entryPointPatterns))
  .map(node => node.relativePath);
```

**`packages/core/src/index.ts`** — Export any new functions.

**`packages/cli/src/commands/scan.ts`** — Add `--orphans` flag:
- When `--orphans` is passed with `--json`, include `orphanFiles` array in output.
- When `--orphans` is passed without `--json`, print orphan list to stderr before launching UI.
- Add `orphanFiles` to `ExplorerGraphData` so the web UI can display them.

**`packages/web-ui/src/App.tsx`** and **`packages/web-ui/src/components/FileTreeView.tsx`**:
- Add visual indicator (e.g., dimmed opacity or ⚠️ badge) for orphan files in the tree.
- Add "Orphans only" filter toggle next to the existing "Circular only" toggle.

#### Acceptance Criteria
- [ ] `depxray scan --mode dependencies --json` output includes `orphanFiles: string[]`
- [ ] `depxray scan --mode dependencies --orphans` prints orphan file list to stderr
- [ ] Browser UI shows orphan badge on files with `inDegree === 0` (excluding entry points)
- [ ] Browser UI has "Orphans only" toggle filter
- [ ] Entry points are configurable and have sensible defaults
- [ ] Unit tests for orphan detection logic
- [ ] Existing tests still pass

---

### FEATURE 2: Interactive Force-Directed Dependency Graph

**Priority**: 🔴 HIGH — Most visually impressive missing feature. Every competitor has some graph viz.

**Competitive gap**: madge uses Graphviz, dependency-cruiser uses DOT/Mermaid, skott uses vis-js. depxray has none.

#### Overview
Add an interactive force-directed graph view in the browser UI as a toggle alongside the existing Miller columns panel.

#### Files to Create

**`packages/web-ui/src/components/ForceGraphView.tsx`** — New component:
- Use `react-force-graph-2d` (Canvas-based, handles large graphs)
- Props: `nodes`, `edges`, `selectedNodeId`, `onSelectNode`, `circularNodeIds`
- Nodes colored by file extension (`.ts` = blue, `.tsx` = purple, `.css` = green, etc.)
- Edges as arrows showing import direction
- Circular dependency edges highlighted in red
- Click node → calls `onSelectNode` (syncs with file tree + details panel)
- Supports zoom, pan, drag
- Node labels show file basename
- Hover tooltip shows relative path + in/out degree

#### Files to Modify

**`packages/web-ui/package.json`** — Add dependency:
```json
"dependencies": {
  "react-force-graph-2d": "^1.x.x"
}
```

**`packages/web-ui/src/App.tsx`**:
- Add state: `const [viewMode, setViewMode] = useState<'miller' | 'graph'>('miller');`
- In the center column, toggle between `<MillerColumnsPanel>` and `<ForceGraphView>`
- Pass `onSelectNode` to ForceGraphView so clicking a node syncs everything

**`packages/web-ui/src/components/ExplorerToolbar.tsx`**:
- Add a toggle button/icon to switch between "Miller" and "Graph" views

**`packages/web-ui/src/styles.css`**:
- Add styles for the graph view container and toggle button

#### Implementation Notes
- Convert `ExplorerGraphNode[]` and `ExplorerGraphEdge[]` to the format `react-force-graph-2d` expects: `{ nodes: [{id, ...}], links: [{source, target, ...}] }`
- For dependency mode: use dependency edges directly
- For structure mode: use parent-child edges
- Filter graph nodes based on search/circular filters (same as tree view)
- Performance: for repos with >1000 files, enable `enableNodeDrag={true}` and `cooldownTicks={100}`

#### Acceptance Criteria
- [ ] Toggle button in toolbar switches between Miller columns and graph view
- [ ] Graph shows all files as nodes, colored by extension
- [ ] Import edges shown as directional arrows
- [ ] Circular edges highlighted in red/orange
- [ ] Clicking a node selects it in the file tree and shows details/code
- [ ] Zoom, pan, and node dragging work
- [ ] Graph view works in both structure and dependency modes
- [ ] Graph renders for repos with 500+ files without freezing
- [ ] Works in static HTML export

---

### FEATURE 3: MCP Server for AI Agents

**Priority**: 🔴 HIGH — Blue ocean opportunity. No competitor has this.

**Competitive gap**: No dependency analysis npm package provides an MCP server. depxray would be the first.

#### Overview
Create an MCP (Model Context Protocol) server that exposes depxray's scanning capabilities as tools for AI agents. This allows Claude, Cursor, Copilot, and other AI tools to query dependency information directly.

#### Files to Create

**`packages/mcp/`** — New workspace package:
```
packages/mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server entry point
│   └── tools/
│       ├── scanProject.ts
│       ├── inspectFile.ts
│       ├── findCircular.ts
│       ├── findOrphans.ts
│       ├── getFileTree.ts
│       └── getFolderSummary.ts
```

**`packages/mcp/package.json`**:
```json
{
  "name": "@depxray/mcp",
  "version": "1.0.0",
  "description": "MCP server for depxray dependency analysis",
  "main": "./dist/index.js",
  "bin": {
    "depxray-mcp": "./dist/index.js"
  },
  "dependencies": {
    "@depxray/core": "1.0.0",
    "@modelcontextprotocol/sdk": "^1.x.x"
  }
}
```

**`packages/mcp/src/index.ts`** — MCP server setup:
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'depxray',
  version: '1.0.0',
});

// Register tools:
// - scan_project: Full dependency graph scan
// - inspect_file: Single file imports/dependents
// - find_circular: Circular dependency chains
// - find_orphans: Unused files
// - get_file_tree: Project structure
// - get_folder_summary: Folder-level metrics
```

#### MCP Tools Specification

| Tool Name | Input | Output |
|---|---|---|
| `scan_project` | `{ rootDir: string, mode?: 'structure' \| 'dependencies' }` | Full `ExplorerGraphData` JSON |
| `inspect_file` | `{ filePath: string, rootDir?: string }` | `{ imports: [...], dependents: [...] }` |
| `find_circular` | `{ rootDir: string }` | `{ chains: CircularChain[] }` |
| `find_orphans` | `{ rootDir: string }` | `{ orphanFiles: string[] }` |
| `get_file_tree` | `{ rootDir: string, maxDepth?: number }` | `FileTreeNode` JSON |
| `get_folder_summary` | `{ rootDir: string, folderPath: string }` | Folder metrics JSON |

#### Files to Modify

**Root `package.json`** — Add workspace:
```json
"workspaces": ["packages/core", "packages/cli", "packages/web-ui", "packages/mcp"]
```

#### Acceptance Criteria
- [ ] `npx @depxray/mcp` starts an MCP server over stdio
- [ ] All 6 tools are registered and callable
- [ ] `scan_project` returns valid JSON matching `ExplorerGraphData` schema
- [ ] `inspect_file` returns imports and dependents for a given file
- [ ] Server works with Claude Desktop MCP config
- [ ] README with setup instructions for Claude Desktop / Cursor
- [ ] Unit tests for each tool handler

---

### FEATURE 4: Configuration File Support

**Priority**: 🟡→🔴 MEDIUM-HIGH — Enables persistent settings; prerequisite for rules.

#### Overview
Support a `depxray.config.js` (or `.depxrayrc.json`) configuration file so users don't need to pass CLI flags every time.

#### Files to Create

**`packages/core/src/loadConfig.ts`** — New module:
```typescript
export interface DepxrayConfig {
  ignore?: string[];
  extensions?: string[];
  entryPoints?: string[];
  mode?: 'structure' | 'dependencies';
  circular?: boolean;
  aliases?: boolean;
  port?: number;
  depth?: number | 'all';
}

export async function loadConfig(rootDir: string): Promise<DepxrayConfig>;
```
- Look for (in order): `depxray.config.js`, `depxray.config.mjs`, `.depxrayrc.json`, `depxray` key in `package.json`
- Use `import()` for JS configs, `JSON.parse` for JSON
- CLI flags override config values

#### Files to Modify

**`packages/cli/src/commands/scan.ts`**:
- At the start of the `action` handler, call `loadConfig(rootDir)`
- Merge config with CLI options (CLI wins)

**`packages/core/src/index.ts`** — Export `loadConfig`.

#### New CLI Command

**`packages/cli/src/commands/init.ts`** — New `depxray init` command:
- Scaffolds a `depxray.config.js` with commented defaults
- Interactive prompts for common options (or `--defaults` flag)

**`packages/cli/src/index.ts`** — Register the new `init` command.

#### Acceptance Criteria
- [ ] `depxray init` creates a `depxray.config.js` with sensible defaults
- [ ] `depxray scan` reads config from project root
- [ ] CLI flags override config values
- [ ] Config supports: `ignore`, `extensions`, `entryPoints`, `mode`, `circular`, `aliases`, `port`, `depth`
- [ ] Error message if config file has invalid values
- [ ] Unit tests for config loading and merging

---

## Feature Specs — Tier 2 (Core Strengthening)

---

### FEATURE 5: Watch Mode with Live Graph Updates

**Priority**: 🟡 MEDIUM

#### Overview
Add `--watch` flag to `depxray scan`. Use `chokidar` to watch for file changes. On change, re-parse only the changed file, update the graph incrementally, and push updates to the browser UI via WebSocket.

#### Files to Modify

**`packages/cli/package.json`** — Add `chokidar` and `ws` dependencies.

**`packages/cli/src/commands/scan.ts`**:
- Add `--watch` flag
- When active: after initial scan and server start, set up chokidar watcher
- On file change: call `parseImports()` + `resolveImports()` for changed file only
- Rebuild affected graph edges
- Push updated `ExplorerGraphData` to connected WebSocket clients

**`packages/web-ui/src/hooks/useGraphData.ts`**:
- Add WebSocket listener for live updates
- On message: update graph data state, triggering re-render

#### Acceptance Criteria
- [ ] `depxray scan --watch` starts watching for file changes
- [ ] Changing a `.ts/.tsx` file updates the browser UI without refresh
- [ ] Adding/deleting a file updates the file tree
- [ ] New circular dependencies are detected and highlighted
- [ ] Terminal shows "[watch] File changed: src/foo.ts — re-scanning..."

---

### FEATURE 6: Complexity & Health Metrics

**Priority**: 🟡 MEDIUM — No competitor does this. Combines dependency analysis with complexity.

#### Overview
Add per-file complexity metrics using the existing Babel AST parser. Calculate LOC, cyclomatic complexity, export count, and instability score.

#### Files to Create

**`packages/core/src/computeMetrics.ts`** — New module:
```typescript
export interface FileMetrics {
  loc: number;                    // Lines of code
  cyclomaticComplexity: number;   // Decision points + 1
  exportCount: number;            // Number of exports
  instability: number;            // outDegree / (outDegree + inDegree), 0-1
}

export function computeFileMetrics(sourceCode: string, filePath: string): Omit<FileMetrics, 'instability'>;
```
- Use Babel AST (already a dependency) to count: `if`, `else if`, `for`, `while`, `do`, `switch case`, `catch`, `&&`, `||`, `??`, ternary `?`
- Count `export` declarations for `exportCount`

#### Files to Modify

**`packages/core/src/types.ts`** — Add `metrics?: FileMetrics` to `GraphNode`.

**`packages/core/src/scanProject.ts`** — After parsing imports, compute metrics for each file. Calculate instability after graph is built.

**`packages/cli/src/commands/scan.ts`** — Include metrics in `ExplorerGraphData` nodes.

**`packages/web-ui/src/components/SelectionPanel.tsx`** — Display metrics in file details panel.

#### Acceptance Criteria
- [ ] JSON output includes `metrics` on each node
- [ ] Browser UI shows LOC, complexity, instability in details panel
- [ ] Cyclomatic complexity calculated via Babel AST traversal
- [ ] Instability = outDegree / (outDegree + inDegree)
- [ ] Unit tests for metric computation

---

### FEATURE 7: Unused npm Dependency Detection

**Priority**: 🟡 MEDIUM

#### Overview
Cross-reference `package.json` dependencies with actual imports found during scanning. Report unused and unlisted dependencies.

#### Files to Create

**`packages/core/src/detectUnusedDeps.ts`**:
```typescript
export interface UnusedDepsResult {
  unused: string[];     // Listed in package.json but never imported
  unlisted: string[];   // Imported but not in package.json
}

export function detectUnusedDeps(
  rootDir: string,
  edges: GraphEdge[],
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
): UnusedDepsResult;
```

#### Files to Modify

**`packages/cli/src/commands/scan.ts`** — Add `--deps` flag.

#### Acceptance Criteria
- [ ] `depxray scan --mode dependencies --deps --json` includes unused/unlisted deps
- [ ] Correctly handles scoped packages (`@org/pkg`)
- [ ] Ignores Node.js built-in modules
- [ ] Unit tests

---

### FEATURE 8: Monorepo / Workspace Awareness

**Priority**: 🟡 MEDIUM

#### Overview
Detect npm/yarn/pnpm workspaces and scan each package. Show cross-package import edges distinctly.

#### Files to Modify

**`packages/core/src/scanProject.ts`** — Add workspace detection. Scan each workspace, then merge graphs with cross-package edges marked.

**`packages/core/src/types.ts`** — Add `workspace?: string` to `GraphNode` and `isCrossPackage?: boolean` to `GraphEdge`.

**`packages/web-ui`** — Color-code nodes by workspace. Show cross-package edges with dashed lines.

#### Acceptance Criteria
- [ ] Automatically detects `workspaces` in root `package.json`
- [ ] Each file's node includes which workspace it belongs to
- [ ] Cross-package edges marked with `isCrossPackage: true`
- [ ] Browser UI visually distinguishes workspaces

---

## Feature Specs — Tier 3 (Advanced)

---

### FEATURE 9: Lightweight Architecture Rule Validation

#### Overview
Define simple forbidden/allowed import rules in config. Validate against the graph. Exit non-zero for CI.

#### Config Syntax
```javascript
// depxray.config.js
export default {
  rules: [
    { from: 'src/ui/**', to: 'src/db/**', severity: 'error', message: 'UI cannot import DB' },
  ]
};
```

#### Files to Create
**`packages/core/src/validateRules.ts`**

#### Acceptance Criteria
- [ ] `depxray scan --validate` exits with code 1 if any `error` severity rules are violated
- [ ] Violations printed to stderr with file paths and rule messages
- [ ] Browser UI highlights violating edges

---

### FEATURE 10: Graph Diffing

#### Overview
Compare two graph JSON snapshots and output added/removed files, edges, and circular deps.

#### New Command
`depxray diff <before.json> <after.json>` — or `depxray diff --base main`

#### Files to Create
**`packages/cli/src/commands/diff.ts`**
**`packages/core/src/diffGraphs.ts`**

#### Acceptance Criteria
- [ ] Outputs: added files, removed files, new edges, removed edges, new circular deps
- [ ] `--json` flag for machine-readable output
- [ ] Works with two JSON file paths or git ref comparison

---

### FEATURE 11: Export Formats (Mermaid, DOT, SVG)

#### Overview
Output dependency graphs in Mermaid or DOT format for embedding in docs/PRs.

#### Files to Modify
**`packages/cli/src/commands/scan.ts`** — Add `--format mermaid|dot` option (with `--json`).
**`packages/cli/src/formatters/mermaid.ts`** — New formatter.

Note: `packages/cli/src/formatters/dot.ts` already exists and can be extended.

#### Acceptance Criteria
- [ ] `depxray scan --mode dependencies --json --format mermaid` outputs valid Mermaid syntax
- [ ] `depxray scan --mode dependencies --json --format dot` outputs valid DOT syntax
- [ ] Output is pasteable into GitHub Markdown or Mermaid Live Editor

---

### FEATURE 12: Plugin/Hook System

#### Overview
Allow extending depxray with plugins registered in config.

#### Hooks
- `afterScan(result: ScanResult)` — modify/extend scan results
- `afterBuildGraph(graph: DependencyGraph)` — add custom node/edge metadata
- `onReport(data: ExplorerGraphData)` — custom output formats

#### Acceptance Criteria
- [ ] Plugins registered in `depxray.config.js` as `plugins: [...]`
- [ ] Each plugin is a module exporting hook functions
- [ ] Built-in plugins: `@depxray/plugin-complexity`, `@depxray/plugin-mcp`

---

### FEATURE 13: VS Code Extension

#### Overview
Inline dependency info in the editor.

#### Features
- CodeLens showing import/dependent count above each file
- "Explore in depxray" command
- Sidebar with dependency tree for active file
- Inline circular dependency warnings

#### New Package
**`packages/vscode/`** — VS Code extension package

---

### FEATURE 14: `depxray report` — Summary Report

#### Overview
Generate a Markdown summary report of project health.

#### New Command
`depxray report [dir]` → outputs Markdown to stdout or file.

#### Report Contents
- Total files, imports, circular chains
- Top 10 most-imported files (hub files)
- Top 10 most-importing files (complex files)
- Orphan files list
- Complexity hotspots (if metrics enabled)

#### Files to Create
**`packages/cli/src/commands/report.ts`**

#### Acceptance Criteria
- [ ] `depxray report` outputs valid Markdown
- [ ] `depxray report --output report.md` writes to file
- [ ] Includes top-10 lists sorted by degree/complexity

---

## Recommended Implementation Order

| Version | Features | Theme |
| :--- | :--- | :--- |
| **v1.1** | Feature 1 (Orphans) + Feature 2 (Force Graph) | *"See it all"* |
| **v1.2** | Feature 3 (MCP Server) + Feature 4 (Config File) | *"AI-native"* |
| **v1.3** | Feature 5 (Watch Mode) + Feature 14 (Report) | *"Developer experience"* |
| **v1.4** | Feature 6 (Complexity) + Feature 7 (Unused Deps) | *"Deeper insights"* |
| **v1.5** | Feature 8 (Monorepo) + Feature 11 (Export Formats) | *"Scale up"* |
| **v2.0** | Feature 9 (Rules) + Feature 10 (Diff) + Feature 12 (Plugins) | *"Best-in-class"* |

---

## Usage Notes for AI Agents

> When implementing any feature from this document:
>
> 1. **Read the "Codebase Architecture Context" section first** — understand the monorepo layout, data flow, and type system.
> 2. **Each feature is self-contained** — implement one at a time. Don't mix features.
> 3. **Follow existing patterns** — look at how `detectCircularDeps.ts` was added to the pipeline for examples of extending the core.
> 4. **Run tests** — `npm test` from the root runs all workspace tests.
> 5. **Build before testing CLI** — `npm run build` from root builds all packages.
> 6. **The web-ui is bundled into CLI at build time** — after changing web-ui, rebuild with `npm run build`.
