# React Dependency Graph - Tree-First Rebuild Plan

## 1. Product Direction

React Dependency Graph should be a practical codebase explorer, not just a large node picture.

The previous graph-first UI works for small projects, but it breaks down once a repo has hundreds of files. A dense canvas becomes hard to read, hard to navigate, and hard to use for precise questions like "what imports this file?" or "what files does this folder depend on?"

The new direction is tree-first:

```bash
npx react-dependency-graph scan .
```

The browser opens a file explorer-style UI:

- Left pane: searchable project tree
- Center pane: selected file or folder details
- Right pane: imports, imported-by files, cycles, and related files
- Optional focused graph: only for the selected file, folder, cycle, or small cluster

The CLI and core scanner stay. The browser UI is the part to recreate.

## 2. Core Idea

The main unit is the file, not the component.

File-level relationships are more stable and easier to explain:

- `src/App.tsx` imports `src/components/Header.tsx`
- `src/pages/Home.tsx` is imported by `src/routes.tsx`
- `src/utils/api.ts` participates in a circular dependency

Component-level analysis can come later, but it should not be the default model.

## 3. MVP Scope

The next MVP should prioritize large-repo usability:

- Render repo structure as a collapsible text tree
- Search files and folders by path
- Select a file and show direct imports
- Select a file and show files that import it
- Show circular dependency status at file level
- Show import metadata: type-only, dynamic, imported names, raw specifier
- Select a folder and summarize files, imports, incoming references, outgoing references, and cycles inside that folder
- Keep JSON and HTML export working
- Keep dependency scanner and alias resolution working

The full node graph becomes secondary. It should never be the default view for an entire large repo.

## 4. Non-Goals For This Rebuild

- Do not build component-level linking yet
- Do not show every file relationship in one global graph
- Do not add a database or long-running indexer
- Do not require project configuration before the first scan
- Do not replace `@rdg/core`; extend the data shape only where needed

## 5. Architecture

```text
rdg-workspace/
├── packages/
│   ├── core/      # scanners, file tree, dependency graph, JSON data
│   ├── cli/       # public package: react-dependency-graph
│   └── web-ui/    # tree-first browser UI bundled into the CLI
├── package.json
└── DEVELOPMENT_PLAN.md
```

Current package roles:

| Package | Role |
| --- | --- |
| `@rdg/core` | Pure TypeScript scanner for file trees and dependency graphs |
| `react-dependency-graph` | Public CLI package and `npx` entrypoint |
| `@rdg/web-ui` | React browser UI bundled into the CLI build |

## 6. Data Model

Keep the existing graph-set envelope, but make the UI derive tree and relationship views from it.

Current high-level shape:

```typescript
interface ExplorerGraphSet {
  schemaVersion: string;
  generatedBy: string;
  projectRoot: string;
  scannedAt: string;
  availableModes: Array<'structure' | 'dependencies'>;
  defaultMode: 'structure' | 'dependencies';
  graphs: {
    structure?: ExplorerGraphData;
    dependencies?: ExplorerGraphData;
  };
}
```

Add UI-level derived indexes:

```typescript
interface FileRelationshipIndex {
  nodeById: Map<string, ExplorerGraphNode>;
  childrenByParentId: Map<string, ExplorerGraphNode[]>;
  importsBySourceId: Map<string, ExplorerGraphEdge[]>;
  importedByTargetId: Map<string, ExplorerGraphEdge[]>;
  circularNodeIds: Set<string>;
}
```

This avoids forcing the UI to traverse all nodes and edges repeatedly when a user clicks around.

## 7. New Web UI Shape

Replace graph-first screens with a three-pane explorer:

```text
┌─────────────────────────────────────────────────────────────┐
│ Toolbar: search, mode, filters, export info                 │
├───────────────────┬───────────────────────┬─────────────────┤
│ File Tree         │ Selected Item         │ Relationships   │
│                   │                       │                 │
│ src/              │ src/App.tsx           │ Imports         │
│   App.tsx         │ path, size, ext       │ Imported by     │
│   components/     │ in/out counts         │ Cycles          │
│     Header.tsx    │ circular status       │ Related files   │
└───────────────────┴───────────────────────┴─────────────────┘
```

Suggested components:

| Component | Responsibility |
| --- | --- |
| `ExplorerLayout` | Main three-pane app layout |
| `FileTreeView` | Collapsible folders and files |
| `FileTreeRow` | One row in the tree |
| `SelectionPanel` | Details for selected file or folder |
| `RelationshipPanel` | Imports, imported-by, cycles, related files |
| `RelationshipList` | Dense list of file links |
| `FocusedGraphView` | Optional small graph for selected context |
| `Toolbar` | Search, mode, filters, export/server status |

## 8. Interaction Rules

Tree behavior:

- Folders expand and collapse
- Search reveals matching paths and their ancestors
- Keyboard navigation should support arrow up/down later
- Large folders should stay readable with compact rows

File selection:

- Clicking a file selects it
- The details panel shows path, extension, depth, size, in-degree, out-degree, and circular status
- The relationships panel shows direct imports and imported-by files

Folder selection:

- Clicking a folder selects it
- The details panel shows file count, child count, descendant count, and total import activity under that folder
- The relationships panel shows files inside the folder with external incoming or outgoing references

Dependency filters:

- Toggle type-only imports
- Toggle dynamic imports
- Toggle circular-only focus
- Keep these filters consistent with JSON/export behavior where possible

## 9. CLI Behavior

The public package is:

```bash
npx react-dependency-graph scan .
```

Supported commands:

```bash
npx react-dependency-graph scan .
npx react-dependency-graph scan . --mode dependencies
npx react-dependency-graph scan . --json
npx react-dependency-graph scan . --html
npx react-dependency-graph inspect src/App.tsx --dir .
```

The `rdg` binary can remain as a local alias after install, but `npx rdg` is not the public install command because the npm package name `rdg` is already taken.

## 10. Rebuild Milestones

### vNext.1 - Relationship Indexes

- Add a web-ui hook for building relationship indexes from the graph set
- Keep the existing CLI JSON shape stable
- Add unit coverage for derived imports/imported-by/circular indexes where practical

Deliverable: selecting a file can read its relationship data in O(1)-style map lookups.

### vNext.2 - Tree-First Layout

- Replace the current graph-first layout with a three-pane explorer
- Implement `FileTreeView`
- Keep search and mode switching
- Keep side panels dense and readable

Deliverable: large repos are navigable without opening a global graph.

### vNext.3 - File Relationship Panels

- Show imports from selected file
- Show files importing selected file
- Show type-only and dynamic import badges
- Show circular status and cycle participants when available

Deliverable: a user can answer "what is related to this file?" quickly.

### vNext.4 - Folder Summaries

- Summarize selected folder activity
- List external incoming references to files in the folder
- List outgoing references from files in the folder to outside files
- Surface circular files inside the folder

Deliverable: a user can understand a feature folder or route folder without reading every file.

### vNext.5 - Focused Graph

- Reintroduce the React Flow graph only for selected context
- Supported contexts: selected file neighborhood, selected folder, circular cluster
- Avoid rendering the whole project as one graph by default

Deliverable: graph view becomes useful again because it is small and focused.

### vNext.6 - Local Package Trial

- Keep `npm pack` flow working
- Document local trial against another project
- Verify HTML export still works after the UI rebuild

Deliverable: the package is testable before publish with:

```bash
npm exec --package=/path/to/react-dependency-graph-0.1.0.tgz -- react-dependency-graph scan /path/to/project
```

## 11. Success Criteria

This rebuild is successful when:

- A repo with hundreds of files is readable without zooming a canvas
- A selected file clearly shows imports and imported-by files
- Circular files are visible from the tree and relationship panel
- The global graph is no longer required for normal navigation
- `npx react-dependency-graph scan .` remains the main entrypoint
- `--json` and `--html` still work
- The publishable package remains self-contained

## 12. Recommended Next Implementation Step

Start with `vNext.1` and `vNext.2` together:

- Build relationship indexes in `@rdg/web-ui`
- Replace the graph-first app shell with the three-pane explorer
- Leave the old graph component in place but move it out of the default path

This gives immediate usability improvement without changing the scanner or CLI contract first.
