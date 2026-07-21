# depxray v3.0 — Implementation Specification

> **For AI coding agents (Codex, Claude Code, etc.)**: This document contains exact implementation specs for new features. Each feature includes file paths, TypeScript interfaces, function signatures, data flows, test cases, and step-by-step instructions. Implement features in the numbered order below.

---

## Project Architecture Reference

```
packages/
  core/           # @depxray/core — scanner, analysis engine, types
    src/
      index.ts          # public API barrel file — ALL new exports go here
      types.ts          # ALL shared TypeScript interfaces
      scanProject.ts    # main scan orchestrator
      analyzeImpact.ts  # impact analysis (pattern reference for new modules)
      plugins.ts        # built-in plugins and hook runners
  mcp/            # @depxray/mcp — MCP stdio server for AI agents
    src/
      index.ts          # server setup, ALL tool registrations go here
      tools/
        shared.ts       # resolveRootDir, jsonContent, ExplorerGraphNode types
        analyzeImpact.ts  # pattern reference for new MCP tools
        findCircular.ts   # simple MCP tool pattern reference
        tools.test.ts     # ALL MCP tool tests go here
  web-ui/         # @depxray/web-ui — React browser UI (Vite)
    src/
      App.tsx                 # main app component, state management
      types.ts                # UI-specific types
      relationshipIndex.ts    # graph indexing, getFolderSummary, getImpactSummary
      hooks/useGraphData.ts   # data loading
      components/
        ExplorerToolbar.tsx   # top toolbar with search, filters, view toggles
        ForceGraphView.tsx    # force-directed graph (react-force-graph-2d)
        SelectionPanel.tsx    # file/folder details panel
        FileTreeView.tsx      # collapsible file tree
        FileCodeViewer.tsx    # source code viewer
        MillerColumnsPanel.tsx  # Miller columns dependency drilldown
  cli/            # depxray — published CLI package
    src/commands/
      scan.ts       # main scan command
      check.ts      # CI check command
      report.ts     # markdown report command
```

**Build order**: `core` → `web-ui` → `mcp` → `cli` (each depends on the previous).

**Test command**: `npm test` from the monorepo root, or `npm test --workspace @depxray/mcp` for one package.

**Test framework**: Vitest. Tests use `describe`/`it`/`expect` from `vitest`.

**Test fixture directories**:
- `packages/core/__tests__/fixtures/simple-project/` — 7-file TypeScript project
- `packages/core/__tests__/fixtures/circular-project/` — project with circular deps and orphans

---

## FEATURE 1: `check_health` MCP Tool

**Priority**: 🥇 HIGH — Agents need a fast project health summary before starting work.

### Step 1: Add `computeHealthScore()` to `@depxray/core`

**Create file**: `packages/core/src/computeHealthScore.ts`

```typescript
import type { ScanResult } from './types.js';

export interface HealthScoreResult {
  /** Overall letter grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60) */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  /** Numeric score from 0 to 100 */
  score: number;

  /** Issue counts by category */
  issues: {
    circularChains: number;
    orphanFiles: number;
    unusedExports: number;
    unresolvedImports: number;
    ruleViolations: number;
  };

  /** Top files by cyclomatic complexity, descending. Max 5. */
  hotspots: Array<{
    file: string;
    complexity: number;
    loc: number;
  }>;

  /** Top files by incoming import count (inDegree), descending. Max 5. */
  hubs: Array<{
    file: string;
    inDegree: number;
    outDegree: number;
  }>;
}

/**
 * Compute a health score from a completed scan result.
 *
 * Scoring formula (start at 100, subtract penalties):
 * - Each circular chain: -5 (max -25)
 * - Each orphan file: -2 (max -20)
 * - Each unused export: -0.5 (max -15)
 * - Each unresolved import: -3 (max -15)
 * - Each rule violation (error): -5 (max -25)
 * - Average complexity > 10: -10
 * - Average complexity > 20: -10 more
 *
 * Score is clamped to [0, 100].
 */
export function computeHealthScore(result: ScanResult): HealthScoreResult {
  // Implementation: compute score, grade, hotspots, hubs from result
  // Grade thresholds: A >= 90, B >= 80, C >= 70, D >= 60, F < 60
  // Hotspots: sort result.graph.nodes by metrics.cyclomaticComplexity desc, take top 5
  // Hubs: sort result.graph.nodes by inDegree desc, take top 5
}
```

### Step 2: Export from `packages/core/src/index.ts`

Add these lines to the appropriate sections in `packages/core/src/index.ts`:

```typescript
// In the "Main API" section:
export { computeHealthScore } from './computeHealthScore.js';

// In the "Types" section:
export type { HealthScoreResult } from './computeHealthScore.js';
```

### Step 3: Create MCP tool handler

**Create file**: `packages/mcp/src/tools/checkHealth.ts`

```typescript
import { computeHealthScore, scanProject } from '@depxray/core';
import { resolveRootDir } from './shared.js';

export interface CheckHealthInput {
  rootDir: string;
}

export async function checkHealthTool(input: CheckHealthInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const result = await scanProject({ rootDir, detectCircular: true });
  return computeHealthScore(result);
}
```

### Step 4: Register in MCP server

**Modify file**: `packages/mcp/src/index.ts`

Add import at top with other tool imports:
```typescript
import { checkHealthTool } from './tools/checkHealth.js';
```

Add registration inside `createDepxrayMcpServer()` after the last `server.registerTool` call:
```typescript
server.registerTool(
  'check_health',
  {
    title: 'Check project health',
    description: 'Return a health scorecard with grade, issue counts, complexity hotspots, and dependency hubs.',
    inputSchema: {
      rootDir: rootDirSchema,
    },
  },
  async (input) => jsonContent(await checkHealthTool(input)),
);
```

### Step 5: Add test

**Modify file**: `packages/mcp/src/tools/tools.test.ts`

Add import:
```typescript
import { checkHealthTool } from './checkHealth.js';
```

Add test case inside the `describe` block:
```typescript
it('returns a health scorecard for check_health', async () => {
  const result = await checkHealthTool({ rootDir: SIMPLE_PROJECT });

  expect(result.grade).toMatch(/^[A-F]$/);
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(100);
  expect(result.issues).toHaveProperty('circularChains');
  expect(result.issues).toHaveProperty('orphanFiles');
  expect(result.issues).toHaveProperty('unusedExports');
  expect(result.hotspots).toBeInstanceOf(Array);
  expect(result.hubs).toBeInstanceOf(Array);
});
```

### Step 6: Update MCP README

**Modify file**: `packages/mcp/README.md`

Add `check_health` to the Tools table:
```markdown
| `check_health` | The agent needs a quick project health assessment before starting work. | `{ "rootDir": "/path/to/project" }` |
```

---

## FEATURE 2: `find_unused_exports` MCP Tool

**Priority**: 🥇 HIGH — The #1 cleanup question agents ask.

### Step 1: Create MCP tool handler

**Create file**: `packages/mcp/src/tools/findUnusedExports.ts`

```typescript
import * as path from 'node:path';
import { scanProject } from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
} from './shared.js';

export interface FindUnusedExportsInput {
  rootDir: string;
  /** Optional: limit results to a single file. Relative paths resolve from rootDir. */
  filePath?: string;
}

export interface UnusedExportEntry {
  file: string;
  exportName: string;
  kind: 'named' | 'default' | 'reexport';
  isTypeOnly: boolean;
  line: number;
}

export async function findUnusedExportsTool(input: FindUnusedExportsInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const result = await scanProject({ rootDir, detectCircular: false });

  let entries: UnusedExportEntry[] = [];

  for (const node of result.graph.nodes) {
    if (!node.unusedExports || node.unusedExports.length === 0) {
      continue;
    }

    if (input.filePath) {
      const targetPath = resolveProjectPath(rootDir, input.filePath);
      assertPathInsideRoot(rootDir, targetPath);
      if (node.id !== targetPath) {
        continue;
      }
    }

    for (const unusedExport of node.unusedExports) {
      entries.push({
        file: node.relativePath,
        exportName: unusedExport.name,
        kind: unusedExport.kind,
        isTypeOnly: unusedExport.isTypeOnly,
        line: unusedExport.line,
      });
    }
  }

  return {
    count: entries.length,
    unusedExports: entries,
  };
}
```

### Step 2: Register in MCP server

**Modify file**: `packages/mcp/src/index.ts`

Add import:
```typescript
import { findUnusedExportsTool } from './tools/findUnusedExports.js';
```

Add registration:
```typescript
server.registerTool(
  'find_unused_exports',
  {
    title: 'Find unused exports',
    description: 'Find exports that are never imported by any other file in the project. Optionally filter to a single file.',
    inputSchema: {
      rootDir: rootDirSchema,
      filePath: z.string().min(1).optional().describe('Optional file path to limit results to a single file.'),
    },
  },
  async (input) => jsonContent(await findUnusedExportsTool(input)),
);
```

### Step 3: Add test

**Modify file**: `packages/mcp/src/tools/tools.test.ts`

Add import:
```typescript
import { findUnusedExportsTool } from './findUnusedExports.js';
```

Add test:
```typescript
it('finds unused exports across the project', async () => {
  const result = await findUnusedExportsTool({ rootDir: SIMPLE_PROJECT });

  expect(result.count).toBeGreaterThanOrEqual(0);
  expect(result.unusedExports).toBeInstanceOf(Array);
  for (const entry of result.unusedExports) {
    expect(entry).toHaveProperty('file');
    expect(entry).toHaveProperty('exportName');
    expect(entry).toHaveProperty('kind');
    expect(entry).toHaveProperty('line');
  }
});
```

### Step 4: Update MCP README

Add to Tools table in `packages/mcp/README.md`:
```markdown
| `find_unused_exports` | The agent needs to find dead exports for cleanup. | `{ "rootDir": "/path/to/project" }` |
```

---

## FEATURE 3: `explain_dependency_chain` MCP Tool

**Priority**: 🥇 HIGH — Answers "why does file A depend on file B?"

### Step 1: Add `findDependencyChain()` to `@depxray/core`

**Create file**: `packages/core/src/findDependencyChain.ts`

```typescript
import * as path from 'node:path';
import type { DependencyGraph, GraphNode } from './types.js';

export interface DependencyChainResult {
  /** Whether a dependency path exists from `from` to `to` */
  connected: boolean;

  /** The source file (relative path) */
  from: string;

  /** The target file (relative path) */
  to: string;

  /** All shortest paths from `from` to `to`. Each path is an array of relative file paths. */
  chains: string[][];

  /** Length of the shortest path, or -1 if not connected */
  shortestDistance: number;
}

/**
 * Find all shortest dependency chains from one file to another using BFS.
 *
 * A chain from A to B means A (directly or transitively) imports B.
 * Each chain is an array of relative file paths: [A, ..., B].
 *
 * @param graph - The dependency graph from scanProject()
 * @param fromPath - Source file path (absolute or relative to rootDir)
 * @param toPath - Target file path (absolute or relative to rootDir)
 * @returns DependencyChainResult with all shortest paths
 */
export function findDependencyChain(
  graph: DependencyGraph,
  fromPath: string,
  toPath: string,
): DependencyChainResult {
  // Resolve both paths to absolute using graph.rootDir
  // Build forward adjacency map from graph.edges (source -> target[])
  // BFS from fromNode, collecting ALL shortest paths to toNode
  // Return chains as arrays of relative paths
  // If not connected, return { connected: false, chains: [], shortestDistance: -1 }
}
```

**Algorithm**:
1. Build forward adjacency: `Map<string, string[]>` from `graph.edges` mapping `edge.source → edge.target`
2. BFS from `fromNode.id`, tracking `Map<string, { distance: number, predecessors: string[] }>` for each visited node
3. When `toNode.id` is reached, reconstruct all shortest paths by backtracking through predecessors
4. Convert absolute paths to relative using `path.relative(graph.rootDir, nodeId)`

### Step 2: Export from `packages/core/src/index.ts`

```typescript
export { findDependencyChain } from './findDependencyChain.js';
export type { DependencyChainResult } from './findDependencyChain.js';
```

### Step 3: Create MCP tool handler

**Create file**: `packages/mcp/src/tools/explainDependencyChain.ts`

```typescript
import {
  findDependencyChain,
  scanProject,
} from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
} from './shared.js';

export interface ExplainDependencyChainInput {
  rootDir?: string;
  from: string;
  to: string;
}

export async function explainDependencyChainTool(input: ExplainDependencyChainInput) {
  const rootDir = resolveRootDir(input.rootDir ?? process.cwd());
  const fromPath = resolveProjectPath(rootDir, input.from);
  const toPath = resolveProjectPath(rootDir, input.to);
  assertPathInsideRoot(rootDir, fromPath);
  assertPathInsideRoot(rootDir, toPath);

  const result = await scanProject({ rootDir, detectCircular: false });
  return findDependencyChain(result.graph, fromPath, toPath);
}
```

### Step 4: Register in MCP server

**Modify file**: `packages/mcp/src/index.ts`

Add import:
```typescript
import { explainDependencyChainTool } from './tools/explainDependencyChain.js';
```

Add registration:
```typescript
server.registerTool(
  'explain_dependency_chain',
  {
    title: 'Explain dependency chain',
    description: 'Find and explain the import chain between two files. Shows all shortest dependency paths from one file to another.',
    inputSchema: {
      from: z.string().min(1).describe('Source file path. The file that imports (directly or transitively).'),
      to: z.string().min(1).describe('Target file path. The file being imported.'),
      rootDir: rootDirSchema.optional().describe('Project root directory. Defaults to the MCP process working directory.'),
    },
  },
  async (input) => jsonContent(await explainDependencyChainTool(input)),
);
```

### Step 5: Add tests

**Modify file**: `packages/mcp/src/tools/tools.test.ts`

Add import:
```typescript
import { explainDependencyChainTool } from './explainDependencyChain.js';
```

Add tests:
```typescript
it('explains a dependency chain between two connected files', async () => {
  const result = await explainDependencyChainTool({
    rootDir: SIMPLE_PROJECT,
    from: 'src/App.tsx',
    to: 'src/utils/helpers.ts',
  });

  expect(result.connected).toBe(true);
  expect(result.chains.length).toBeGreaterThan(0);
  expect(result.shortestDistance).toBeGreaterThan(0);
  expect(result.chains[0][0]).toBe('src/App.tsx');
  expect(result.chains[0][result.chains[0].length - 1]).toBe('src/utils/helpers.ts');
});

it('reports disconnected files in dependency chain', async () => {
  const result = await explainDependencyChainTool({
    rootDir: CIRCULAR_PROJECT,
    from: 'src/standalone.ts',
    to: 'src/a.ts',
  });

  expect(result.connected).toBe(false);
  expect(result.chains).toEqual([]);
  expect(result.shortestDistance).toBe(-1);
});
```

---

## FEATURE 4: `find_related_files` MCP Tool

**Priority**: 🥈 MEDIUM — Helps agents know what other files to check after editing.

### Step 1: Create MCP tool handler

**Create file**: `packages/mcp/src/tools/findRelatedFiles.ts`

```typescript
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { scanProject } from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
} from './shared.js';

export interface FindRelatedFilesInput {
  rootDir?: string;
  filePath: string;
}

export async function findRelatedFilesTool(input: FindRelatedFilesInput) {
  const rootDir = resolveRootDir(input.rootDir ?? process.cwd());
  const filePath = resolveProjectPath(rootDir, input.filePath);
  assertPathInsideRoot(rootDir, filePath);

  const result = await scanProject({ rootDir, detectCircular: false });
  const node = result.graph.nodes.find((n) => n.id === filePath);
  if (!node) {
    throw new Error(`File not found in dependency graph: ${input.filePath}`);
  }

  // Direct imports (files this file imports)
  const imports = result.graph.edges
    .filter((edge) => edge.source === filePath)
    .map((edge) => path.relative(rootDir, edge.target));

  // Direct dependents (files that import this file)
  const dependents = result.graph.edges
    .filter((edge) => edge.target === filePath)
    .map((edge) => path.relative(rootDir, edge.source));

  // Sibling files in the same directory
  const dir = path.dirname(filePath);
  let siblings: string[] = [];
  try {
    const entries = await fs.readdir(dir);
    siblings = entries
      .filter((entry) => {
        const entryPath = path.join(dir, entry);
        return entryPath !== filePath;
      })
      .map((entry) => path.relative(rootDir, path.join(dir, entry)));
  } catch {
    // Directory not readable, skip siblings
  }

  // Co-located files sharing the same basename (e.g., Button.tsx -> Button.test.tsx, Button.module.css)
  const basename = path.basename(filePath).replace(/\.[^.]+$/, '');
  const colocated = siblings.filter((sibling) => {
    const siblingBasename = path.basename(sibling).replace(/\.[^.]+$/, '');
    return siblingBasename.startsWith(basename) && sibling !== node.relativePath;
  });

  return {
    file: node.relativePath,
    imports,
    dependents,
    siblings,
    colocated,
  };
}
```

### Step 2: Register in MCP server

**Modify file**: `packages/mcp/src/index.ts`

Add import:
```typescript
import { findRelatedFilesTool } from './tools/findRelatedFiles.js';
```

Add registration:
```typescript
server.registerTool(
  'find_related_files',
  {
    title: 'Find related files',
    description: 'Find files related to a given file: direct imports, dependents, directory siblings, and co-located files sharing the same name stem (e.g., Button.tsx and Button.test.tsx).',
    inputSchema: {
      filePath: z.string().min(1).describe('File path to find related files for. Relative paths resolve from rootDir.'),
      rootDir: rootDirSchema.optional().describe('Project root directory. Defaults to the MCP process working directory.'),
    },
  },
  async (input) => jsonContent(await findRelatedFilesTool(input)),
);
```

### Step 3: Add test

**Modify file**: `packages/mcp/src/tools/tools.test.ts`

Add import:
```typescript
import { findRelatedFilesTool } from './findRelatedFiles.js';
```

Add test:
```typescript
it('finds related files for a given file', async () => {
  const result = await findRelatedFilesTool({
    rootDir: SIMPLE_PROJECT,
    filePath: 'src/App.tsx',
  });

  expect(result.file).toBe('src/App.tsx');
  expect(result.imports).toBeInstanceOf(Array);
  expect(result.dependents).toBeInstanceOf(Array);
  expect(result.siblings).toBeInstanceOf(Array);
  expect(result.colocated).toBeInstanceOf(Array);
});
```

---

## FEATURE 5: `suggest_cleanup` MCP Tool

**Priority**: 🥈 MEDIUM — Tells agents exactly what to clean up, in priority order.

### Step 1: Create MCP tool handler

**Create file**: `packages/mcp/src/tools/suggestCleanup.ts`

```typescript
import * as path from 'node:path';
import { scanProject } from '@depxray/core';
import { resolveRootDir } from './shared.js';

export interface SuggestCleanupInput {
  rootDir: string;
  maxSuggestions?: number;
}

export interface CleanupSuggestion {
  action: 'remove_unused_export' | 'delete_orphan_file' | 'fix_circular_dependency' | 'resolve_broken_import' | 'remove_unused_dependency';
  file: string;
  detail: string;
  impact: 'safe' | 'review' | 'risky';
  reason: string;
}

export async function suggestCleanupTool(input: SuggestCleanupInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const maxSuggestions = input.maxSuggestions ?? 10;
  const result = await scanProject({ rootDir, detectCircular: true, detectUnusedDeps: true });

  const suggestions: CleanupSuggestion[] = [];

  // 1. Orphan files (safe to delete — nothing imports them)
  for (const orphanFile of result.orphanFiles) {
    suggestions.push({
      action: 'delete_orphan_file',
      file: orphanFile,
      detail: orphanFile,
      impact: 'safe',
      reason: 'No incoming imports and not an entry point.',
    });
  }

  // 2. Unused exports (safe to remove — nothing imports them)
  for (const node of result.graph.nodes) {
    for (const unusedExport of node.unusedExports ?? []) {
      suggestions.push({
        action: 'remove_unused_export',
        file: node.relativePath,
        detail: unusedExport.name,
        impact: 'safe',
        reason: `Export "${unusedExport.name}" is not imported by any file.`,
      });
    }
  }

  // 3. Unresolved imports (requires investigation)
  for (const unresolved of result.unresolvedImports) {
    suggestions.push({
      action: 'resolve_broken_import',
      file: unresolved.file,
      detail: unresolved.importSpecifier,
      impact: 'review',
      reason: `Import "${unresolved.importSpecifier}" does not resolve to any file.`,
    });
  }

  // 4. Unused npm dependencies (safe to remove from package.json)
  if (result.dependencyIssues) {
    for (const unusedDep of result.dependencyIssues.unused) {
      suggestions.push({
        action: 'remove_unused_dependency',
        file: 'package.json',
        detail: unusedDep,
        impact: 'safe',
        reason: `Package "${unusedDep}" is in package.json but not imported by any scanned file.`,
      });
    }
  }

  // 5. Circular dependencies (risky — requires careful refactoring)
  for (const chain of result.graph.circularDependencies) {
    suggestions.push({
      action: 'fix_circular_dependency',
      file: chain.chain[0],
      detail: chain.description,
      impact: 'risky',
      reason: `Circular chain: ${chain.description}`,
    });
  }

  // Sort: safe first, then review, then risky. Limit to maxSuggestions.
  const impactOrder = { safe: 0, review: 1, risky: 2 };
  suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return {
    count: Math.min(suggestions.length, maxSuggestions),
    totalIssues: suggestions.length,
    suggestions: suggestions.slice(0, maxSuggestions),
  };
}
```

### Step 2: Register in MCP server

**Modify file**: `packages/mcp/src/index.ts`

Add import:
```typescript
import { suggestCleanupTool } from './tools/suggestCleanup.js';
```

Add registration:
```typescript
server.registerTool(
  'suggest_cleanup',
  {
    title: 'Suggest cleanup actions',
    description: 'Return a prioritized list of cleanup suggestions: orphan files to delete, unused exports to remove, unresolved imports to fix, and circular dependencies to break.',
    inputSchema: {
      rootDir: rootDirSchema,
      maxSuggestions: z.number().int().positive().optional().describe('Maximum number of suggestions to return. Default 10.'),
    },
  },
  async (input) => jsonContent(await suggestCleanupTool(input)),
);
```

### Step 3: Add test

Add to `packages/mcp/src/tools/tools.test.ts`:

```typescript
import { suggestCleanupTool } from './suggestCleanup.js';

it('suggests cleanup actions prioritized by safety', async () => {
  const result = await suggestCleanupTool({ rootDir: CIRCULAR_PROJECT });

  expect(result.count).toBeGreaterThan(0);
  expect(result.suggestions).toBeInstanceOf(Array);
  for (const suggestion of result.suggestions) {
    expect(suggestion).toHaveProperty('action');
    expect(suggestion).toHaveProperty('file');
    expect(suggestion).toHaveProperty('impact');
    expect(suggestion).toHaveProperty('reason');
    expect(['safe', 'review', 'risky']).toContain(suggestion.impact);
  }
  // Verify safe suggestions come first
  const impacts = result.suggestions.map((s) => s.impact);
  const safeIndex = impacts.indexOf('safe');
  const riskyIndex = impacts.indexOf('risky');
  if (safeIndex !== -1 && riskyIndex !== -1) {
    expect(safeIndex).toBeLessThan(riskyIndex);
  }
});
```

---

## FEATURE 6: `diff_graphs` MCP Tool

**Priority**: 🥈 MEDIUM — Lets agents self-review before creating PRs.

### Step 1: Create MCP tool handler

**Create file**: `packages/mcp/src/tools/diffGraphs.ts`

```typescript
import { execSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { diffGraphs, scanProject } from '@depxray/core';
import { resolveRootDir } from './shared.js';

export interface DiffGraphsInput {
  rootDir: string;
  /** Git ref to compare against (e.g., "main", "HEAD~1"). */
  baseRef: string;
}

export async function diffGraphsTool(input: DiffGraphsInput) {
  const rootDir = resolveRootDir(input.rootDir);

  // Scan current working tree
  const currentResult = await scanProject({ rootDir, detectCircular: true });

  // Create a temp directory with the base ref checkout and scan it
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'depxray-diff-'));
  try {
    execSync(`git -C ${JSON.stringify(rootDir)} archive ${input.baseRef} | tar -x -C ${JSON.stringify(tmpDir)}`, {
      stdio: 'pipe',
    });
    const baseResult = await scanProject({ rootDir: tmpDir, detectCircular: true });

    return diffGraphs(baseResult.graph, currentResult.graph);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
```

### Step 2: Register in MCP server

**Modify file**: `packages/mcp/src/index.ts`

Add import:
```typescript
import { diffGraphsTool } from './tools/diffGraphs.js';
```

Add registration:
```typescript
server.registerTool(
  'diff_graphs',
  {
    title: 'Diff dependency graphs',
    description: 'Compare the current dependency graph against a git base ref. Shows added/removed files, edges, and circular dependency changes.',
    inputSchema: {
      rootDir: rootDirSchema,
      baseRef: z.string().min(1).describe('Git ref to compare against (e.g., "main", "HEAD~1").'),
    },
  },
  async (input) => jsonContent(await diffGraphsTool(input)),
);
```

---

## FEATURE 7: Codebase Health Dashboard View (Browser UI)

**Priority**: 🥇 HIGH — Visual health scorecard in the browser.

### Step 1: Add `computeHealthScore` to UI data flow

The `computeHealthScore()` function is already available from `@depxray/core` (Feature 1). The scan command in `packages/cli/src/commands/scan.ts` must include the health score in the graph data sent to the browser.

**Modify file**: `packages/web-ui/src/types.ts`

Add to the `ExplorerGraphData` interface:
```typescript
healthScore?: {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  issues: {
    circularChains: number;
    orphanFiles: number;
    unusedExports: number;
    unresolvedImports: number;
    ruleViolations: number;
  };
  hotspots: Array<{ file: string; complexity: number; loc: number }>;
  hubs: Array<{ file: string; inDegree: number; outDegree: number }>;
};
```

### Step 2: Create DashboardView component

**Create file**: `packages/web-ui/src/components/DashboardView.tsx`

**Props interface**:
```typescript
interface DashboardViewProps {
  index: FileRelationshipIndex;
  healthScore: ExplorerGraphData['healthScore'] | undefined;
  onSelectNode: (nodeId: string) => void;
}
```

**Component sections** (use simple SVG `<rect>` elements for bar charts — no external chart library):
1. **Health grade badge**: Large letter (A/B/C/D/F) with colored circle background. Grade colors: A=#15803d, B=#2563eb, C=#b45309, D=#c2410c, F=#b33a32.
2. **Issue summary row**: Four cards showing circularChains, orphanFiles, unusedExports, unresolvedImports counts.
3. **Complexity hotspots**: Horizontal bar chart using SVG `<rect>` elements. Each bar width proportional to complexity value. On click, call `onSelectNode` with the file's absolute path.
4. **Dependency hubs**: Same horizontal bar chart for inDegree.

**CSS class names**: Use existing pattern `panel-header`, `detail-list`, `eyebrow`, `badge-row`. Add new classes prefixed with `dashboard-` (e.g., `dashboard-grade`, `dashboard-chart`, `dashboard-card`).

### Step 3: Add Dashboard to center view options

**Modify file**: `packages/web-ui/src/components/ExplorerToolbar.tsx`

Change the `centerViewMode` type from `'miller' | 'graph'` to `'miller' | 'graph' | 'dashboard'`.

Add a third button in the `center-view-toggle` div:
```tsx
<button
  className={centerViewMode === 'dashboard' ? 'active' : ''}
  onClick={() => onCenterViewModeChange('dashboard')}
  title="Show codebase health dashboard"
  type="button"
>
  Dashboard
</button>
```

**Modify file**: `packages/web-ui/src/App.tsx`

1. Change `centerViewMode` state type to `'miller' | 'graph' | 'dashboard'`.
2. Import `DashboardView` component.
3. Add a third branch in the center column render:
```tsx
{centerViewMode === 'dashboard' ? (
  <DashboardView
    index={index}
    healthScore={dataSet?.graphs.dependencies?.healthScore}
    onSelectNode={selectAndExpandNode}
  />
) : centerViewMode === 'miller' ? (
  // existing MillerColumnsPanel
) : (
  // existing ForceGraphView
)}
```

### Step 4: Wire health score data from CLI

**Modify file**: `packages/mcp/src/tools/shared.ts`

In the `toDependencyGraphData()` function, add `healthScore` to the returned object. Import `computeHealthScore` from `@depxray/core` and call it with the `ScanResult`.

**Also modify**: `packages/cli/src/commands/scan.ts` — same change where the browser graph data is constructed. The `computeHealthScore(result)` return value should be added as `healthScore` property in the graph data object sent to the web UI.

---

## FEATURE 8: Heatmap Overlay Modes (Browser UI)

**Priority**: 🥈 MEDIUM — Color graph nodes by different metrics.

### Step 1: Add coloring mode state

**Modify file**: `packages/web-ui/src/components/ForceGraphView.tsx`

Add a new prop to `ForceGraphViewProps`:
```typescript
colorMode: 'extension' | 'complexity' | 'size' | 'instability';
onColorModeChange: (mode: 'extension' | 'complexity' | 'size' | 'instability') => void;
```

### Step 2: Add coloring functions

In `ForceGraphView.tsx`, add these functions alongside the existing `getNodeColor()`:

```typescript
function interpolateHeatColor(value: number, max: number): string {
  // Gradient from #15803d (green, low) → #b45309 (amber, mid) → #b33a32 (red, high)
  const t = max > 0 ? Math.min(value / max, 1) : 0;
  if (t < 0.5) {
    // green → amber
    const r = Math.round(21 + (180 - 21) * (t * 2));
    const g = Math.round(128 + (83 - 128) * (t * 2));
    const b = Math.round(61 + (9 - 61) * (t * 2));
    return `rgb(${r},${g},${b})`;
  }
  // amber → red
  const r = Math.round(180 + (179 - 180) * ((t - 0.5) * 2));
  const g = Math.round(83 + (58 - 83) * ((t - 0.5) * 2));
  const b = Math.round(9 + (50 - 9) * ((t - 0.5) * 2));
  return `rgb(${r},${g},${b})`;
}

function getNodeColorByMode(
  node: ForceGraphNode,
  selectedNodeId: string | null,
  colorMode: 'extension' | 'complexity' | 'size' | 'instability',
  maxComplexity: number,
  maxSize: number,
): string {
  if (node.id === selectedNodeId) return '#0f6b59';
  if (colorMode === 'extension') return getNodeColor(node, selectedNodeId);
  if (colorMode === 'complexity') return interpolateHeatColor(node.complexity ?? 0, maxComplexity);
  if (colorMode === 'size') return interpolateHeatColor(node.sizeBytes ?? 0, maxSize);
  if (colorMode === 'instability') return interpolateHeatColor(node.instability ?? 0, 1);
  return getNodeColor(node, selectedNodeId);
}
```

Add `complexity`, `sizeBytes`, and `instability` to the `ForceGraphNode` interface.

### Step 3: Add dropdown to graph header

In the `graph-header-actions` div, add:
```tsx
<label className="graph-label-select" title="Color nodes by">
  <span>Color</span>
  <select
    value={colorMode}
    onChange={(event) => onColorModeChange(event.target.value as any)}
  >
    <option value="extension">Extension</option>
    <option value="complexity">Complexity</option>
    <option value="size">File Size</option>
    <option value="instability">Instability</option>
  </select>
</label>
```

### Step 4: Wire state in App.tsx

Add `colorMode` state in `App.tsx` and pass it to `ForceGraphView`.

---

## FEATURE 9: `@depxray/plugin-github-pr` Plugin

**Priority**: 🥈 MEDIUM — Gets depxray into every PR review.

### Step 1: Add as built-in plugin

**Modify file**: `packages/core/src/plugins.ts`

Add a new plugin:
```typescript
export const githubPrPlugin: DepxrayPlugin = {
  name: '@depxray/plugin-github-pr',
  async onReport(data, context) {
    // data is expected to be a GraphDiffResult from diffGraphs()
    // Format as a markdown PR comment string
    // Return the formatted markdown
    const diff = data as import('./diffGraphs.js').GraphDiffResult;
    const lines: string[] = ['## 📊 depxray Dependency Report\n'];

    if (diff.addedFiles.length > 0) {
      lines.push(`### Added files (${diff.addedFiles.length})`);
      for (const file of diff.addedFiles.slice(0, 10)) {
        lines.push(`- \`${file}\``);
      }
    }

    if (diff.removedFiles.length > 0) {
      lines.push(`### Removed files (${diff.removedFiles.length})`);
      for (const file of diff.removedFiles.slice(0, 10)) {
        lines.push(`- \`${file}\``);
      }
    }

    if (diff.addedCircular.length > 0) {
      lines.push(`### ⚠️ New circular dependencies (${diff.addedCircular.length})`);
      for (const chain of diff.addedCircular) {
        lines.push(`- ${chain.description}`);
      }
    }

    if (diff.resolvedCircular.length > 0) {
      lines.push(`### ✅ Resolved circular dependencies (${diff.resolvedCircular.length})`);
      for (const chain of diff.resolvedCircular) {
        lines.push(`- ${chain.description}`);
      }
    }

    return { ...diff, markdownComment: lines.join('\n') };
  },
};
```

Add to `BUILT_IN_PLUGINS`:
```typescript
export const BUILT_IN_PLUGINS: Record<string, DepxrayPlugin> = {
  '@depxray/plugin-complexity': complexityPlugin,
  '@depxray/plugin-mcp': mcpPlugin,
  '@depxray/plugin-github-pr': githubPrPlugin,
};
```

---

## Verification Plan

After implementing each feature, run:

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Verify MCP tools specifically
npm test --workspace @depxray/mcp

# Verify core
npm test --workspace @depxray/core

# Manual: start MCP server and test with a client
npx --package @depxray/mcp depxray-mcp
```

---

## Summary: Files to Create

| File | Feature |
| --- | --- |
| `packages/core/src/computeHealthScore.ts` | Feature 1 |
| `packages/core/src/findDependencyChain.ts` | Feature 3 |
| `packages/mcp/src/tools/checkHealth.ts` | Feature 1 |
| `packages/mcp/src/tools/findUnusedExports.ts` | Feature 2 |
| `packages/mcp/src/tools/explainDependencyChain.ts` | Feature 3 |
| `packages/mcp/src/tools/findRelatedFiles.ts` | Feature 4 |
| `packages/mcp/src/tools/suggestCleanup.ts` | Feature 5 |
| `packages/mcp/src/tools/diffGraphs.ts` | Feature 6 |
| `packages/web-ui/src/components/DashboardView.tsx` | Feature 7 |

## Summary: Files to Modify

| File | Features |
| --- | --- |
| `packages/core/src/index.ts` | 1, 3 |
| `packages/core/src/plugins.ts` | 9 |
| `packages/mcp/src/index.ts` | 1, 2, 3, 4, 5, 6 |
| `packages/mcp/src/tools/tools.test.ts` | 1, 2, 3, 4, 5 |
| `packages/mcp/src/tools/shared.ts` | 7 |
| `packages/mcp/README.md` | 1, 2, 3, 4, 5, 6 |
| `packages/web-ui/src/types.ts` | 7 |
| `packages/web-ui/src/App.tsx` | 7, 8 |
| `packages/web-ui/src/components/ExplorerToolbar.tsx` | 7 |
| `packages/web-ui/src/components/ForceGraphView.tsx` | 8 |
| `packages/cli/src/commands/scan.ts` | 7 |
