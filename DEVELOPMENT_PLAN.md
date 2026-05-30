# React Dependency Graph — New Development Plan

> **Important Note**: This plan pivots the product direction. The existing `@rdg/core` dependency scanner and CLI are valuable and will be **kept as-is**. This plan adds a new first-class feature: the **Project Structure Graph**, served via a local browser — making it the new MVP entry point (`npx rdg scan`).

---

## 1. Updated Product Concept

**React Dependency Graph** is a developer tool that helps you understand any React project visually — in your browser, with zero configuration.

Run one command from any React project:
```bash
npx rdg scan
```

A browser opens at `http://localhost:5178` showing an **interactive Project Structure Graph**: all your folders and files laid out as circular nodes you can zoom, pan, search, and explore by depth.

**Who it's for**: Developers onboarding to a new codebase, AI coding agents (Claude, Codex, Antigravity) that need structured project context, and architects reviewing project structure.

---

## 2. MVP Scope

The MVP (`v0.1–v0.5`) delivers **Project Structure Graph** via a local browser:

- ✅ Scan folder/file tree from project root (ignore `node_modules`, `.git`, `dist`, etc.)
- ✅ Display as **circular nodes** with **short name labels**
- ✅ Depth layer selector (1, 2, 3, 4, All)
- ✅ Expand/collapse folder nodes
- ✅ Click a node → side panel shows full path + details
- ✅ Search for file/folder by name
- ✅ Zoom, pan, fit view
- ✅ Export structure as JSON
- ✅ `npx rdg scan` → opens browser automatically
- ✅ `npx rdg scan --html` → generates `.react-dependency-graph/index.html`

---

## 3. What Is NOT in MVP

- ❌ Dependency graph (import analysis) — v0.7
- ❌ Circular dependency detection — v0.7
- ❌ tsconfig path alias resolution — v0.7+
- ❌ Full-stack flow tracing — post-v1.0
- ❌ Claude MCP server — post-v1.0

---

## 4. Recommended Monorepo Architecture

```
react-dependency-graph/                ← Root workspace
├── packages/
│   ├── core/                          ← @rdg/core — pure TypeScript, zero UI deps
│   ├── cli/                           ← react-dependency-graph — npx entry point
│   ├── web-ui/                        ← @rdg/web-ui — React + React Flow app
├── package.json                       ← npm workspaces root
├── tsconfig.base.json
└── .gitignore
```

**Key principle**: `@rdg/core` has **zero dependencies** on React, browser APIs, or Express. It is a pure Node.js TypeScript library.

---

## 5. Folder Structure (Full)

```
react-dependency-graph/
├── package.json
├── tsconfig.base.json
│
├── packages/
│   │
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts              # Public API barrel
│   │       ├── types.ts              # ALL shared types
│   │       ├── scanFileTree.ts       # Scan folder/file hierarchy
│   │       ├── filterTreeByDepth.ts  # Filter to N layers
│   │       ├── buildGraph.ts         # Tree → graph nodes + edges
│   │       ├── expandCollapse.ts     # Expand/collapse logic
│   │       ├── exportGraph.ts        # Serialize to JSON
│   │       └── scanDependencies.ts   # [v0.7] Import/dep scanner
│   │
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # CLI entry (shebang + commander)
│   │       └── commands/
│   │           └── scan.ts           # scan command (browser / --json / --html)
│   │
│   ├── web-ui/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── types.ts              # Re-export from @rdg/core types
│   │       ├── components/
│   │       │   ├── GraphView.tsx     # React Flow canvas
│   │       │   ├── CircleNode.tsx    # Custom circular node renderer
│   │       │   ├── SidePanel.tsx     # Selected node details
│   │       │   ├── Toolbar.tsx       # Depth selector, search, controls
│   │       │   └── SearchBox.tsx
│   │       └── hooks/
│   │           ├── useGraphData.ts   # Fetch /api/graph-data
│   │           └── useTreeState.ts   # Expand/collapse state
│   │
└── .react-dependency-graph/          # Generated output dir (gitignored)
    ├── index.html                    # Static HTML export
    └── graph-data.json               # Embedded graph data
```

---

## 6. Core Package Responsibilities (`@rdg/core`)

| Module | Responsibility |
|--------|---------------|
| `types.ts` | All shared TypeScript interfaces |
| `scanFileTree.ts` | Walk directory, build `FileTreeNode` tree, respect ignore patterns |
| `filterTreeByDepth.ts` | Take full tree → return tree truncated at depth N |
| `buildGraph.ts` | Convert `FileTreeNode` tree → `GraphNode[]` + `GraphEdge[]` for React Flow |
| `expandCollapse.ts` | Toggle collapsed state on a node, return updated node list |
| `exportGraph.ts` | Serialize graph to JSON |
| `scanDependencies.ts` | [v0.7] Parse imports using `@babel/parser` |

---

## 7. CLI Package Responsibilities (`react-dependency-graph`)

All functionality is exposed through a **single `scan` command** with flags:

| Command | Responsibility |
|---------|---------------|
| `rdg scan` | Scan project, start Express/sirv server, open browser at `localhost:5178` (default) |
| `rdg scan --json` | Scan + print JSON to stdout (pipeline-friendly) |
| `rdg scan --json --output <file>` | Scan + write JSON to file |
| `rdg scan --html` | Generate static HTML into `.react-dependency-graph/index.html` |
| `rdg scan --depth <n>` | Set initial visible depth (default: 2) |
| `rdg scan --port <n>` | Override server port (default: 5178) |
| `rdg scan --mode dependencies` | [v0.7] Show dependency graph instead of structure graph |

---

## 8. Web UI Package Responsibilities (`@rdg/web-ui`)

- **Standalone Vite + React app** served by the CLI's local server
- Fetches graph data from `/api/graph-data` (served by CLI server)
- In static export mode, reads data embedded in the HTML as `window.__GRAPH_DATA__`
- Renders an interactive React Flow canvas with **circular nodes**
- Components: `GraphView`, `CircleNode`, `SidePanel`, `Toolbar`, `SearchBox`

---

## 9. Data Structures

### File Tree Node
```typescript
/** A single node in the raw scanned file tree */
export interface FileTreeNode {
  /** Unique ID — absolute path */
  id: string;
  /** Short display name: "Button", "src", "package.json" */
  name: string;
  /** Full path relative to project root: "src/components/Button.tsx" */
  relativePath: string;
  /** Absolute path on disk */
  absolutePath: string;
  /** Type of node */
  kind: 'file' | 'directory';
  /** File extension (e.g. ".tsx") or null for directories */
  extension: string | null;
  /** Nesting depth from project root (root = 0) */
  depth: number;
  /** Children — only populated for directories */
  children: FileTreeNode[];
  /** File size in bytes (undefined for directories) */
  sizeBytes?: number;
}
```

### Graph Node (for React Flow)
```typescript
/** A node in the React Flow visualization */
export interface GraphNode {
  /** React Flow node ID (= FileTreeNode.id) */
  id: string;
  /** Short label shown on the circle */
  label: string;
  /** Full relative path — shown in tooltip/side panel only */
  relativePath: string;
  /** Absolute path */
  absolutePath: string;
  /** 'file' | 'directory' */
  kind: 'file' | 'directory';
  /** File extension or null */
  extension: string | null;
  /** Depth from root */
  depth: number;
  /** Whether this directory node is currently collapsed */
  collapsed: boolean;
  /** Whether this node is hidden (because ancestor is collapsed) */
  hidden: boolean;
  /** Number of direct children (for directories) */
  childCount: number;
  /** Total descendant count (for directories, recursive) */
  descendantCount: number;
}
```

### Graph Edge (for React Flow)
```typescript
/** A directed edge: parent → child in the file tree */
export interface GraphEdge {
  /** React Flow edge ID */
  id: string;
  /** Parent node ID */
  source: string;
  /** Child node ID */
  target: string;
}
```

### Visible Graph (what the UI renders)
```typescript
export interface VisibleGraph {
  /** The depth limit currently applied */
  maxDepth: number;
  /** Nodes to render (hidden nodes excluded) */
  nodes: GraphNode[];
  /** Edges to render */
  edges: GraphEdge[];
  /** Project root path */
  projectRoot: string;
  /** Scan timestamp */
  scannedAt: string;
  /** Total file count (including hidden) */
  totalFiles: number;
  /** Total directory count */
  totalDirs: number;
}
```

### Selected Node Details
```typescript
export interface NodeDetails {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  kind: 'file' | 'directory';
  extension: string | null;
  depth: number;
  sizeBytes?: number;
  childCount?: number;
  descendantCount?: number;
  /** For files: what depth layer this file is at */
  layerPath: string[];
}
```

### Future Dependency Node & Edge
```typescript
/** [v0.7] Dependency graph node */
export interface DependencyNode {
  id: string;           // absolute path
  relativePath: string;
  extension: string;
  inDegree: number;     // how many files import this
  outDegree: number;    // how many files this imports
  isCircular: boolean;
}

/** [v0.7] Dependency graph edge */
export interface DependencyEdge {
  id: string;
  source: string;       // importer
  target: string;       // imported
  importSpecifier: string;
  importedNames: string[];
  isTypeOnly: boolean;
  isDynamic: boolean;
}
```

---

## 11. Algorithm: Scanning Project Folder Structure

```
scanFileTree(rootDir, options):
  1. Verify rootDir exists and is a directory (throw if not)
  2. DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', 'out',
                       'coverage', '.next', '.turbo', '.cache', '.react-dependency-graph']
  3. ignoreSet = DEFAULT_IGNORE ∪ options.ignorePatterns
  4. function walk(dir, depth):
       entries = fs.readdirSync(dir, { withFileTypes: true })
       result = []
       for each entry in entries (sorted: dirs first, then files, alphabetically):
         if entry.name in ignoreSet: SKIP
         absolutePath = path.join(dir, entry.name)
         relativePath = path.relative(rootDir, absolutePath)
         node = {
           id: absolutePath,
           name: entry.name,                    ← short name only
           relativePath,
           absolutePath,
           kind: entry.isDirectory() ? 'directory' : 'file',
           extension: path.extname(entry.name) || null,
           depth,
           children: [],
           sizeBytes: entry.isFile() ? fs.statSync(absolutePath).size : undefined,
         }
         if entry.isDirectory():
           node.children = walk(absolutePath, depth + 1)
         result.push(node)
       return result
  5. rootNode = {
       id: rootDir,
       name: path.basename(rootDir),
       relativePath: '.',
       absolutePath: rootDir,
       kind: 'directory',
       depth: 0,
       children: walk(rootDir, 1),
     }
  6. return rootNode
```

---

## 12. Algorithm: Filtering by Folder/File Hierarchy Depth

```
filterTreeByDepth(rootNode, maxDepth):
  function truncate(node, currentDepth):
    if currentDepth >= maxDepth AND node.kind === 'directory':
      return { ...node, children: [] }   ← keep the dir node but no children
    return {
      ...node,
      children: node.children.map(child => truncate(child, currentDepth + 1))
    }
  return truncate(rootNode, 0)
```

**Layer examples** (maxDepth = number of visible layers of *children*):
- `maxDepth = 1`: only rootNode's direct children are shown
- `maxDepth = 2`: children + grandchildren shown
- `maxDepth = Infinity`: show everything

---

## 13. Algorithm: Expand/Collapse Folders

Each directory `GraphNode` has a `collapsed: boolean` field.

```
toggleCollapse(nodeId, graphNodes):
  target = graphNodes.find(n => n.id === nodeId)
  if target.kind !== 'directory': return graphNodes (no-op)
  
  target.collapsed = !target.collapsed
  
  // Walk all nodes and set hidden = true if any ancestor is collapsed
  for each node in graphNodes:
    node.hidden = isAncestorCollapsed(node, graphNodes)
  
  return graphNodes

isAncestorCollapsed(node, allNodes):
  path = getAncestorPath(node, allNodes)  // [root, ..., parent]
  return path.some(ancestor => ancestor.collapsed)
```

The React Flow graph simply filters out `hidden = true` nodes and their edges before rendering.

---

## 14. Algorithm: Generating Graph Nodes and Edges from File Tree

```
buildGraph(rootNode, maxDepth):
  nodes = []
  edges = []
  
  function visit(node, parentId):
    graphNode = {
      id: node.id,
      label: node.name,            ← short name (see §15)
      relativePath: node.relativePath,
      absolutePath: node.absolutePath,
      kind: node.kind,
      extension: node.extension,
      depth: node.depth,
      collapsed: false,
      hidden: false,
      childCount: node.children.length,
      descendantCount: countDescendants(node),
    }
    nodes.push(graphNode)
    
    if parentId !== null:
      edges.push({
        id: `${parentId}->${node.id}`,
        source: parentId,
        target: node.id,
      })
    
    for each child of node.children:
      visit(child, node.id)
  
  visit(filterTreeByDepth(rootNode, maxDepth), null)
  return { nodes, edges }
```

---

## 15. How to Create Short Display Labels from Full Paths

The `name` field is set during scanning as `path.basename(absolutePath)` — always just the last segment:

| Full Path | `path.basename(...)` → label |
|-----------|------------------------------|
| `src/components/Button.tsx` | `Button.tsx` |
| `src/components/Button` | `Button` |
| `src/hooks/useAuth.ts` | `useAuth.ts` |
| `src` | `src` |
| `package.json` | `package.json` |

> The circle node renders only `name`. The full `relativePath` and `absolutePath` are stored in the node data and shown only in the side panel / tooltip.

---

## 16. Handling Duplicate File Names in Different Folders

Since nodes are identified by their **absolute path** (not name), duplicate names (e.g., `index.tsx` in many folders) are handled transparently:

- Each node has a unique `id` (absolute path)
- The **label** on the circle shows just the name (can be duplicate — this is intentional, like a real file system)
- When a user clicks a node, the **side panel** shows the full relative path, making it clear which file they selected
- **Search** matches against `relativePath` (full path), not just `name`, so searching `components/index` shows only the right one

---

## 17. Visually Distinguishing Folders and Files (Both Circular)

Both folders and files use **circular nodes** as requested, but with visual differences:

| Attribute | Directory | File |
|-----------|-----------|------|
| Fill color | `#3b82f6` (blue) | `#10b981` (green/teal) |
| Border | Dashed | Solid |
| Size | Larger (80px) | Smaller (60px) |
| Icon (inside circle) | 📁 folder emoji or SVG | Extension-based (`.tsx` → ⚛, `.ts` → T, `.json` → `{}`) |
| Expand indicator | Shows `+N` when collapsed | N/A |

---

## 18. Keeping the Graph Readable for Large Projects

For large projects (100+ files/folders), the graph can become overwhelming. Strategies:

1. **Default depth = 2**: On first load, show only 2 levels deep — keeps the graph manageable
2. **Collapsed by default**: Directories beyond depth 2 start collapsed
3. **dagre layout**: Auto-layout positions nodes top-to-bottom by depth layer — logical and clean
4. **Minimap**: React Flow's built-in minimap gives overview of large graphs
5. **Fit view on load**: Auto-zooms to show all visible nodes
6. **Depth selector**: User controls how much to show (1, 2, 3, 4, All)
7. **Search + highlight**: Searching dims non-matching nodes instead of hiding them
8. **Node size proportional to descendant count**: Root dir is biggest, deep files are smallest

---

## 19. Implementing Local Browser Visualization

The `rdg scan` command (default mode):

```
1. Run scanFileTree(cwd) → full file tree
2. Run filterTreeByDepth(tree, defaultDepth=2) → initial visible tree
3. Run buildGraph(tree, 2) → { nodes, edges }
4. Serialize to JSON: graphData = { nodes, edges, projectRoot, scannedAt, ... }
5. Start HTTP server (Express or sirv):
   - GET /           → serve web-ui/dist/index.html
   - GET /assets/*   → serve web-ui/dist/assets/*
   - GET /api/graph-data → return JSON.stringify(graphData)
   - GET /api/tree   → return full raw file tree JSON
6. console.log("✅ Opening http://localhost:5178")
7. open("http://localhost:5178")   ← opens default browser
8. Keep server alive (don't exit)
9. Handle Ctrl+C gracefully
```

The web-ui React app fetches `/api/graph-data` on load and renders the graph. When the user changes the depth slider, it refetches `/api/tree` and recalculates client-side (no server round-trip needed for depth changes — tree is available).

---

## 20. How the CLI Passes Graph Data to the Web UI

**Mode 1: Local server (default)**
```
CLI → Express server → GET /api/graph-data → { nodes, edges, ... }
Web UI (React) → fetch('/api/graph-data') → setState(graphData) → render
```

When depth changes: the web-ui has the full tree from `/api/tree` cached in memory and calls `filterTreeByDepth()` + `buildGraph()` **client-side** in a web worker (no server round-trip).

**Mode 2: Static HTML export**
```
CLI → reads web-ui/dist/index.html → injects:
  <script>window.__GRAPH_DATA__ = { ...fullTree };</script>
→ writes to .react-dependency-graph/index.html
Web UI → checks if window.__GRAPH_DATA__ exists → uses it instead of fetch()
```

---

## 21. Implementing Static HTML Export

```
rdg scan --html:
1. Scan project → full file tree + graph data
2. Read web-ui/dist/index.html (pre-built bundle)
3. Inject before </body>:
   <script>window.__GRAPH_DATA__ = JSON.parse('...');</script>
4. Create .react-dependency-graph/ directory (gitignored)
5. Write modified HTML to .react-dependency-graph/index.html
6. Copy web-ui/dist/assets/ → .react-dependency-graph/assets/
7. Print: "✅ Exported to .react-dependency-graph/index.html"
8. Optionally open the file in browser
```

The web-ui checks:
```typescript
const data = (window as any).__GRAPH_DATA__ 
  ?? await fetch('/api/graph-data').then(r => r.json());
```

---

## 22. How to Export Graph JSON

Two approaches:

**CLI flag:**
```bash
npx rdg scan --json --output structure.json
```
Writes to file. If no `--output`, prints to stdout (pipeline-friendly).

**In-browser export button:**
In the web-ui Toolbar, an "Export JSON" button triggers:
```typescript
const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'structure.json'; a.click();
```

---

## 23. How to Test the Core Scanner Separately

```bash
cd packages/core
npx vitest run
```

Test fixtures (small fake projects):
```
packages/core/__tests__/fixtures/
├── simple-project/          ← flat structure
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   │       └── Button.tsx
│   └── package.json
└── deep-project/            ← 5+ levels deep
```

Test cases:
- `scanFileTree` returns correct tree shape
- `filterTreeByDepth(tree, 1)` returns only root children
- `filterTreeByDepth(tree, 2)` returns two levels
- `buildGraph` produces correct nodes and edges
- `expandCollapse` correctly marks hidden nodes
- Short names are derived correctly
- Ignore patterns work

---

## 24. How to Test the CLI Locally

```bash
# From repo root, link globally
cd packages/cli && npm link

# Test all commands
rdg --help
rdg scan --json
rdg scan --json --output /tmp/test.json
rdg scan           # opens browser
rdg scan --html         # generates .react-dependency-graph/
```

Or without linking:
```bash
node packages/cli/dist/index.js scan /path/to/test-project
```

Integration tests use `execa` to run the compiled CLI and assert stdout/exit code.

---

## 25. How to Test the Browser Visualization

**Locally during development:**
```
# Terminal 1: start CLI server (serves /api/graph-data)
rdg scan /path/to/test-project

# Terminal 2: Vite dev server with proxy to CLI server
cd packages/web-ui
npm run dev      # vite proxies /api/* to localhost:5178
```

Browser opens at `http://localhost:5173` (Vite dev server port).

**Vite proxy config:**
```typescript
// web-ui/vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:5178'
  }
}
```

This way, the React app in dev mode fetches real data from the CLI server.

---

## 26. How to Publish the Package to npm

```bash
# 1. Build everything
npm run build --workspaces

# 2. Set version in CLI package.json
cd packages/cli && npm version 0.1.0

# 3. The CLI package name controls the npx command
# packages/cli/package.json:
{
  "name": "react-dependency-graph",   ← npx react-dependency-graph scan
  "bin": {
    "react-dependency-graph": "./dist/index.js",
    "rdg": "./dist/index.js"            ← npx rdg scan (short alias)
  }
}

# 4. Publish
npm publish --access public
```

> [!IMPORTANT]
> The CLI package (`packages/cli`) needs to **bundle** the built web-ui assets inside it. The web-ui `dist/` should be copied into the CLI package before publishing so that `npx rdg scan` has the assets to serve.

---

## 27. How Users Run it with npx

```bash
# No installation needed — npx downloads and runs automatically
npx rdg scan                              # open browser at localhost:5178

# Scan a specific project directory
npx rdg scan /path/to/my-project

# Output JSON to stdout (AI agent / CI friendly)
npx rdg scan --json
npx rdg scan --json --output structure.json

# Generate a static shareable HTML file
npx rdg scan --html

# Control depth on launch
npx rdg scan --depth 3

# Use the full package name (same thing)
npx react-dependency-graph scan
```

---

## 28. How This Supports Future Integrations

### Antigravity IDE
- Calls `@rdg/core` directly and renders a webview-compatible structure graph

### Claude MCP Server
- A future `@rdg/mcp` package wraps `@rdg/core` with MCP protocol
- Claude calls `scan_structure()` tool → gets back JSON tree
- Claude calls `get_node_details(filePath)` → gets file metadata

### Codex-readable JSON Output
```bash
npx rdg scan --json > structure.json
```
Codex reads `structure.json` as context when working on the project.

### Full-Stack Flow Tracing (post-v1.0)
- `@rdg/core` adds a `traceFlow(componentPath)` function
- Follows import chain: React component → API call → backend route → model → DB table
- Requires language-specific scanners for backend (Python, Node.js routes)

---

## 29. Common Mistakes to Avoid

| Mistake | Solution |
|---------|---------|
| Scanning `node_modules` | Always add to ignore list first |
| Using absolute paths as React Flow node IDs | Use them but convert to relative for display |
| Putting browser/React code in `@rdg/core` | Core = pure Node.js only |
| Not handling `Ctrl+C` in the server | Use `process.on('SIGINT')` to cleanup |
| Rebuilding web-ui on every `npx` run | Pre-build + bundle into the CLI package |
| React Flow freezing on 500+ nodes | Default to depth=2, lazy-load deeper nodes |
| Publishing without bundling web-ui assets | Add a `prepublishOnly` script |
| Having `.react-dependency-graph/` tracked in git | Add to `.gitignore` |
| Forgetting to sort nodes (dirs first) | Always sort for predictable output |

---

## 30. Beginner-Friendly Explanation of Each Part

**`@rdg/core`** — "The brain". It reads your project folder, understands what files and folders exist, and turns that into a clean data structure (a tree). It doesn't know anything about browsers or React. Just pure logic.

**`react-dependency-graph`** — "The command". When you type `npx react-dependency-graph scan`, this is what runs. It asks the brain to scan your project, starts a small web server, and opens your browser.

**`@rdg/web-ui`** — "The face". A React app that lives in your browser. It asks the server for the project data, then draws it as circles connected by lines. You can zoom in, click things, and explore.

**The server** — A tiny local website running on your own computer (`localhost:5178`). It's not on the internet. It just lets the browser talk to the CLI.

**React Flow** — A library that makes it easy to draw connected diagrams (nodes and edges) in a React app. We use it to draw the circles.

**dagre** — An algorithm that automatically figures out where to place each circle so they don't overlap and follow a nice top-to-bottom tree layout.

---

## Roadmap

### v0.1 — Core File Tree Scanner
- Implement `scanFileTree.ts` with ignore patterns
- Implement `filterTreeByDepth.ts`
- Implement `buildGraph.ts`
- Define all types in `types.ts`
- Unit tests with fixture projects
- **Deliverable**: `scanFileTree('/path')` returns a `FileTreeNode` tree

### v0.2 — CLI `scan` Command (JSON mode)
- Set up `commander` CLI with single `scan` command
- `rdg scan [dir]` → default: opens browser
- `rdg scan --json` → prints JSON to stdout
- `rdg scan --json --output <file>` → writes to file
- `--depth <n>` flag → filter by depth
- **Deliverable**: `npx rdg scan --json > structure.json`

### v0.3 — Local Browser Server (Basic)
- Scaffold `@rdg/web-ui` with Vite + React
- `rdg scan` → starts Express server + opens browser
- Basic React Flow graph (default nodes, no circles yet)
- Fetches `/api/graph-data` from server
- **Deliverable**: `npx rdg scan` → browser opens with graph

### v0.4 — Circle Nodes + Depth Selector + Side Panel
- Implement `CircleNode.tsx` custom React Flow node
- Color-code: blue for dirs, green for files
- Depth selector UI (1, 2, 3, 4, All) — recalculates graph client-side
- Side panel: click node → show full path, size, child count
- Short labels on circles, full path in side panel only
- **Deliverable**: Beautiful circular node graph with depth control

### v0.5 — Expand/Collapse + Search + Polish
- Click directory node to expand/collapse its children
- Search box: filter graph by file/folder name
- Fit view on load, zoom controls, minimap
- Keyboard shortcuts (F = fit, Esc = deselect)
- **Deliverable**: Fully interactive structure graph

### v0.6 — Static HTML Export
- `rdg scan --html` flag
- Generates `.react-dependency-graph/index.html` (standalone)
- `window.__GRAPH_DATA__` injection strategy
- Also writes `graph-data.json` alongside
- **Deliverable**: `npx rdg scan --html`

### v0.7 — Dependency Graph Mode
- Reuse existing `@rdg/core` dependency scanner (already built!)
- `rdg scan --mode dependencies` flag
- Second view in web-ui: switch between Structure and Dependencies
- Circular dependency highlighting
- **Deliverable**: `npx rdg scan --mode dependencies`

### v1.0 — Polished npm Package
- `prepublishOnly` bundles web-ui into CLI
- README with demo GIF
- Stable JSON schema (versioned)
- Performance tested on 1000+ file projects
- Published to npm as `react-dependency-graph`

---

## Proposed Changes (Scaffold to Build First)

> [!IMPORTANT]
> This plan reuses the existing `packages/core` and `packages/cli` structure but adds `packages/web-ui` as a new package. The existing dependency scanner code in `@rdg/core` stays — we just **add** the file tree scanner modules alongside it.

### [MODIFY] `packages/core/src/types.ts` — add FileTreeNode, GraphNode, GraphEdge (structure), VisibleGraph, NodeDetails
### [NEW] `packages/core/src/scanFileTree.ts`
### [NEW] `packages/core/src/filterTreeByDepth.ts`
### [NEW] `packages/core/src/buildGraphFromTree.ts`
### [NEW] `packages/core/src/expandCollapse.ts`
### [NEW] `packages/cli/src/commands/scan.ts` — single `scan` command handling all modes
### [NEW] `packages/web-ui/` — full Vite + React package
### [NEW] `packages/web-ui/src/components/CircleNode.tsx`
### [NEW] `packages/web-ui/src/components/GraphView.tsx`
### [NEW] `packages/web-ui/src/components/SidePanel.tsx`
### [NEW] `packages/web-ui/src/components/Toolbar.tsx`

---

## Open Questions

> [!NOTE]
> **Port number**: I plan to use `5178` as the default server port (easily configurable with `--port`). This avoids conflicts with common dev servers (Vite: 5173, CRA: 3000, Next.js: 3000). OK?

> [!NOTE]
> **Package name**: The npm package name will be `react-dependency-graph` (no scope). If this is taken on npm, we'll use `@rdg/react-dependency-graph` or similar. Should I check availability?
