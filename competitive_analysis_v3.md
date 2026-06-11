# depxray v3.0+ — Strategic Enhancement Plan
# Focus: Browser UI · MCP Tools · Plugin Ecosystem

> **Context**: All features from `competitive_analysis.md` and `competitive_analysis_v2.md` are implemented. depxray now has feature parity with rev-dep and exceeds it in many areas. This document focuses on what makes depxray **outstanding** — not just "caught up."

---

## Current State Assessment

### What depxray has now (post v2.x implementation)

**Core analysis**: circular deps, orphan files, unused exports, unresolved imports, unused/unlisted npm deps, devDeps-in-prod, import conventions, architecture rules, restricted imports, entry-point analysis, impact analysis, autofix

**CLI commands**: `scan`, `inspect`, `report`, `diff`, `init`, `check`, `entry-points`, `trace`, `tree`, `impact`

**MCP tools** (7): `scan_project`, `inspect_file`, `analyze_impact`, `find_circular`, `find_orphans`, `get_file_tree`, `get_folder_summary`

**Browser UI**: force graph, file tree, Miller columns, code viewer, selection panel, search, circular/orphan/unused-exports filters, impact highlighting, drag-swap layouts, resizable panels, watch mode

**Plugins** (2 built-in): `@depxray/plugin-complexity`, `@depxray/plugin-mcp`

### Your three unmatched advantages

```
┌──────────────────────────────────────────────────────────────┐
│  1. BROWSER UI — Nobody else has this                        │
│     Force graph + code viewer + file tree + live updates     │
│                                                              │
│  2. MCP SERVER — Best dependency-focused MCP on npm          │
│     7 tools, impact analysis, AI-agent workflow              │
│                                                              │
│  3. PLUGIN HOOKS — Extensible analysis pipeline              │
│     afterBuildGraph, afterScan, onReport                     │
└──────────────────────────────────────────────────────────────┘
```

**Strategy**: Double down on these three pillars. Every new feature should strengthen at least one of them.

---

## PILLAR 1: Browser UI — From Explorer to Intelligence Dashboard

> [!IMPORTANT]
> The browser UI is your **moat**. Rev-dep, Fallow, and Knip can never match this. But right now the UI is a *viewer*. Turn it into an **interactive intelligence dashboard** that developers keep open all day.

### FEATURE 1.1: Interactive Blast-Radius Visualization 🔴 HIGH

**What**: When a user clicks a file in the graph, visually animate the "blast radius" — all files that would be affected if this file changes. Color them by distance (1-hop = red, 2-hop = orange, 3+ = yellow). The current impact analysis data already exists in `getImpactSummary()` — this is purely a UI enhancement.

**Why this is outstanding**: No tool in existence lets you *see* impact propagation visually in a force graph. CodeScene shows hotspots but not blast radius. Pharaoh builds a knowledge graph but has no visual UI. This would be the most screenshot-worthy feature in the entire npm ecosystem.

**Implementation**:
- Add an "Impact Mode" toggle button to the `ForceGraphView` toolbar
- When enabled, clicking a node triggers animated concentric ripple rings on the graph
- Affected nodes pulse/glow by distance tier
- Impact edges get animated directional flow (like electricity flowing through wires)
- Show a floating summary card: "Changing this file affects X files across Y folders"
- The data is already computed by `getImpactSummary()` — this is a rendering feature

**Files to modify**:
- `packages/web-ui/src/components/ForceGraphView.tsx` — add impact mode rendering
- `packages/web-ui/src/components/ExplorerToolbar.tsx` — add impact mode toggle
- `packages/web-ui/src/App.tsx` — wire impact mode state

**Acceptance criteria**:
- [ ] Toggle button enables/disables impact visualization mode
- [ ] Clicking a file shows animated blast radius on graph
- [ ] Nodes colored by distance tier from target
- [ ] Edges show animated directional flow for impact paths
- [ ] Floating summary card with affected file/folder counts

---

### FEATURE 1.2: Codebase Health Dashboard View 🔴 HIGH

**What**: A new dashboard view (alongside graph and Miller columns) that shows an at-a-glance health scorecard for the entire project.

**Why**: Right now, seeing overall project health requires reading the `report` CLI output. Give developers a visual dashboard they can glance at. No competitor has this — CodeScene's dashboards require a paid SaaS subscription.

**Sections to include**:
- **Health Score** (A/B/C/D/F): computed from circular count, orphan %, unused export %, average complexity, unresolved import count
- **Issue Breakdown**: donut chart showing circular / orphan / unused exports / unresolved imports / rule violations
- **Complexity Hotspots**: top 10 most complex files as a bar chart
- **Dependency Hubs**: top 10 files with highest inDegree (most depended-on)
- **Heavy Importers**: top 10 files with highest outDegree (most coupled)
- **Trend Sparklines**: if watch mode is active, show metric trends over time (files changed, health score changes)
- **Workspace Health** (monorepo): per-package breakdown with cross-package edge counts

**Implementation**:
- New `packages/web-ui/src/components/DashboardView.tsx` component
- Added to center column options: Graph | Miller | **Dashboard**
- Toolbar gets a third button in `ExplorerToolbar.tsx`
- All data computed from existing `FileRelationshipIndex` — no new scan logic needed
- Charts use canvas or simple SVG bars (no heavy charting library dependency)

**Acceptance criteria**:
- [ ] New "Dashboard" center view mode with health score and charts
- [ ] Health score computed from existing scan data
- [ ] Complexity hotspots bar chart
- [ ] Hub files list
- [ ] Workspace breakdown for monorepos
- [ ] Works in both live and static HTML export

---

### FEATURE 1.3: Heatmap Overlay Modes 🟡 MEDIUM

**What**: Color the graph by different metrics instead of just file extension/status:
- **Complexity heatmap**: gradient from green (low) → red (high complexity)
- **Size heatmap**: file size from small (dim) → large (bright)
- **Instability heatmap**: stable files (blue) → unstable files (red)
- **Churn heatmap** (future): files changed most in git history

**Why**: This is what CodeScene charges $1000+/month for. Give it away for free in your open-source browser UI.

**Implementation**:
- Dropdown in `ForceGraphView` toolbar: "Color by: Extension | Status | Complexity | Size | Instability"
- Modify `getNodeColor()` in `ForceGraphView.tsx` to accept a coloring strategy
- Existing metrics data already lives on each node — just change the coloring function
- Add a color legend overlay to the graph canvas

---

### FEATURE 1.4: Dependency Diff Viewer in Browser UI 🟡 MEDIUM

**What**: Show the results of `depxray diff` visually in the browser UI. Added files = green nodes, removed = red, changed = yellow. Added edges = green, removed = red.

**Why**: `depxray diff` already computes diffs via `diffGraphs.ts`. But seeing "14 files added, 3 removed" as text is far less useful than seeing the structural changes overlaid on a graph.

**Implementation**:
- New CLI flag: `depxray diff --base main --ui` — opens browser with diff data
- Or: load two JSON snapshots and show the diff visually
- Green glow on added nodes/edges, red on removed, yellow on changed
- Side panel shows a changelog list

---

### FEATURE 1.5: Graph Annotations & Shareable Snapshots 🟢 LOW

**What**: Let users annotate the graph — add labels, draw boundaries around file groups, mark files as "needs refactor". Save annotations and share the URL/snapshot with teammates.

**Why**: This turns depxray from a "tool you run once" into a "tool you use for collaborative architecture discussions." No competitor does this.

**Implementation**:
- Click-and-drag to draw boundary boxes around groups of nodes
- Right-click a node to add a sticky note
- "Share" button generates a self-contained HTML snapshot with annotations embedded
- Annotations stored in `localStorage` for persistence during watch mode

---

### FEATURE 1.6: Keyboard Navigation & Command Palette 🟢 LOW

**What**: Add `Cmd+K` / `Ctrl+K` command palette for power users. Type file names, jump to nodes, toggle filters, switch views. Add arrow key navigation in the file tree.

**Why**: Power users and AI agent demos benefit from fast keyboard-driven navigation.

---

## PILLAR 2: MCP Server — From 7 Tools to the Most Complete Dependency MCP

> [!IMPORTANT]
> Your MCP server already has 7 tools. The trend in 2026 is that agents need **narrow, purpose-specific tools** rather than one big `scan_project`. Each tool should answer ONE question cheaply without scanning the whole project.

### Current MCP gaps

| Agent Question | Current Tool | Gap |
|---|---|---|
| "What are the unused exports in this file?" | `scan_project` (full scan) | Need a lightweight single-file tool |
| "Is this a safe refactor?" | `analyze_impact` ✅ | None |
| "What files are related to this one?" | None | Need `find_related_files` |
| "What's the project health score?" | None | Need `check_health` |
| "Why does this file depend on that one?" | None | Need `explain_dependency_chain` |
| "What should I clean up first?" | None | Need `suggest_cleanup` |
| "What changed between these two states?" | None | Need `diff_graphs` |
| "List all unused exports in the project" | `scan_project` | Need dedicated tool |

### FEATURE 2.1: `find_unused_exports` Tool 🔴 HIGH

**What**: Dedicated MCP tool that returns unused exports for the entire project or a specific file.

**Input**: `{ "rootDir": "/path", "filePath"?: "src/utils.ts" }`

**Output**: Array of `{ file, exportName, kind, isTypeOnly, line }` — compact, no graph data bloat.

**Why**: Agents performing cleanup work shouldn't need a full `scan_project` just to find dead exports. This is the #1 cleanup question agents ask.

**Files to create/modify**:
- `packages/mcp/src/tools/findUnusedExports.ts` — new tool handler
- `packages/mcp/src/index.ts` — register new tool

---

### FEATURE 2.2: `check_health` Tool 🔴 HIGH

**What**: Returns a compact health scorecard: overall grade, issue counts, top 5 hotspots, top 5 hubs.

**Input**: `{ "rootDir": "/path" }`

**Output**: `{ grade: "B", score: 78, issues: { circular: 2, orphans: 5, unusedExports: 12, unresolvedImports: 3, ruleViolations: 1 }, hotspots: [...], hubs: [...] }`

**Why**: Agents starting work on a project need a quick health check before diving in. This is faster and more useful than `scan_project` for initial assessment.

**Files to create/modify**:
- `packages/mcp/src/tools/checkHealth.ts` — new tool handler
- `packages/core/src/healthScore.ts` — health score computation (reusable by CLI report too)

---

### FEATURE 2.3: `explain_dependency_chain` Tool 🔴 HIGH

**What**: Given two files, explain *why* file A depends on file B — showing the full import chain.

**Input**: `{ "rootDir": "/path", "from": "src/App.tsx", "to": "src/utils/math.ts" }`

**Output**: `{ connected: true, chains: [["src/App.tsx", "src/components/Dashboard.tsx", "src/utils/math.ts"]], shortestDistance: 2 }`

**Why**: This is the killer question for refactoring: "Why does this file end up importing that one?" Rev-dep has `resolve` for this. Your MCP doesn't expose it yet. The data is computable from the existing graph — just needs BFS path finding.

**Files to create/modify**:
- `packages/mcp/src/tools/explainDependencyChain.ts` — new tool handler
- Reuse BFS logic from `analyzeImpact.ts`

---

### FEATURE 2.4: `find_related_files` Tool 🟡 MEDIUM

**What**: Given a file, find the most "related" files — direct imports, direct dependents, files in the same folder, files sharing the same naming pattern (e.g., `Button.tsx` → `Button.test.tsx`, `Button.module.css`).

**Input**: `{ "rootDir": "/path", "filePath": "src/Button.tsx" }`

**Output**: `{ imports: [...], dependents: [...], siblings: [...], colocated: ["Button.test.tsx", "Button.module.css"] }`

**Why**: When an agent edits a file, it needs to know what other files to check. This is more useful than `inspect_file` because it includes naming-convention siblings.

**Files to create/modify**:
- `packages/mcp/src/tools/findRelatedFiles.ts` — new tool handler

---

### FEATURE 2.5: `suggest_cleanup` Tool 🟡 MEDIUM

**What**: Returns a prioritized list of cleanup actions the agent can take, ranked by impact and safety.

**Input**: `{ "rootDir": "/path", "maxSuggestions": 10 }`

**Output**: `{ suggestions: [{ action: "remove_unused_export", file: "src/utils.ts", export: "oldHelper", impact: "safe", reason: "Exported but never imported anywhere" }, { action: "delete_orphan_file", file: "src/legacy/old.ts", impact: "safe", reason: "No incoming imports, not an entry point" }, ...] }`

**Why**: This is the "agentic skill" that Fallow promotes. Instead of the agent figuring out what to clean up, depxray tells it exactly what to do, in priority order. Combined with `--fix`, this enables fully autonomous cleanup.

**Files to create/modify**:
- `packages/mcp/src/tools/suggestCleanup.ts` — new tool handler

---

### FEATURE 2.6: `diff_graphs` Tool 🟡 MEDIUM

**What**: Expose graph diffing via MCP. Compare current state vs. a git ref.

**Input**: `{ "rootDir": "/path", "baseRef": "main" }`

**Output**: `{ addedFiles: [...], removedFiles: [...], addedEdges: [...], removedEdges: [...], newCirculars: [...], resolvedCirculars: [...] }`

**Why**: Before an agent creates a PR, it should check if it introduced new circular deps or orphans. This lets it self-review.

**Files to create/modify**:
- `packages/mcp/src/tools/diffGraphs.ts` — new tool handler
- Reuse `diffGraphs()` from `@depxray/core`

---

## PILLAR 3: Plugin Ecosystem — From 2 Built-ins to a Platform

> [!TIP]
> Your plugin system is well-designed (`afterBuildGraph`, `afterScan`, `onReport`). But having only 2 built-in plugins makes the ecosystem feel empty. Add 3-4 useful built-ins and document how to write custom ones.

### FEATURE 3.1: `@depxray/plugin-github-pr` — PR Comment Plugin 🔴 HIGH

**What**: Automatically comment on PRs with dependency health changes.

**Behavior**:
- Runs `depxray diff --base main` during CI
- Posts a PR comment with: files added/removed, new circular deps introduced, new orphans, health score change
- Includes a Mermaid diagram of the changed dependency subgraph
- Can be configured to fail CI if health score drops below threshold

**Why**: This is the integration that gets depxray adopted by teams. Once it's in every PR, it becomes indispensable. Rev-dep doesn't have this. Fallow doesn't have this.

**Implementation**:
- New `packages/plugins/github-pr/` package in the monorepo (or built-in alias)
- Uses `onReport` hook to format diff data as a GitHub PR comment
- Users add to CI: `npx depxray diff --base main --plugins @depxray/plugin-github-pr`
- GitHub Action wrapper for easy setup

---

### FEATURE 3.2: `@depxray/plugin-health-badge` — README Badge 🟡 MEDIUM

**What**: Generate a shields.io-compatible badge showing codebase health grade.

**Output**: `![Codebase Health](https://img.shields.io/badge/depxray-A-brightgreen)` in README

**Why**: Visible badge in README makes depxray adoption viral. Every developer who sees the badge will want it for their repo.

---

### FEATURE 3.3: `@depxray/plugin-sarif` — SARIF Output 🟡 MEDIUM

**What**: Output scan findings in SARIF format for GitHub Code Scanning integration.

**Why**: GitHub's code scanning dashboard ingests SARIF. This puts depxray findings alongside security vulnerabilities in the GitHub UI.

---

### FEATURE 3.4: Plugin Authoring Guide 🟢 LOW

**What**: Comprehensive documentation with examples for writing custom depxray plugins:
- Adding custom metrics to nodes (`afterBuildGraph`)
- Custom export formats (`afterScan`)
- CI integrations (`onReport`)
- Webhook/Slack notifications

---

## Recommended Priority Order

| Priority | Feature | Pillar | Impact |
|---|---|---|---|
| 🥇 1 | **Interactive blast-radius visualization** | UI | *The screenshot that sells depxray* |
| 🥇 2 | **Codebase health dashboard view** | UI | *Keep developers coming back daily* |
| 🥇 3 | **`check_health` MCP tool** | MCP | *Fastest way for agents to assess a project* |
| 🥇 4 | **`find_unused_exports` MCP tool** | MCP | *#1 cleanup question agents ask* |
| 🥇 5 | **`explain_dependency_chain` MCP tool** | MCP | *The refactoring safety net* |
| 🥈 6 | **`@depxray/plugin-github-pr`** | Plugin | *Gets depxray into every PR review* |
| 🥈 7 | **Heatmap overlay modes** | UI | *Free alternative to CodeScene's $1K/mo* |
| 🥈 8 | **`find_related_files` MCP tool** | MCP | *Most useful context for editing* |
| 🥈 9 | **`suggest_cleanup` MCP tool** | MCP | *Autonomous cleanup agent support* |
| 🥉 10 | **Dependency diff viewer in UI** | UI | *Visual PR review* |
| 🥉 11 | **Graph annotations & shareable snapshots** | UI | *Collaborative architecture discussions* |
| 🥉 12 | **`@depxray/plugin-sarif`** | Plugin | *GitHub Code Scanning integration* |
| 🥉 13 | **`@depxray/plugin-health-badge`** | Plugin | *Viral adoption through READMEs* |
| 🥉 14 | **Command palette (Cmd+K)** | UI | *Power user productivity* |

---

## The Big Picture: Why This Makes depxray Outstanding

```
Other tools:  CLI ───► Text output ───► Done

depxray v3.0: CLI ───► Browser Dashboard ───► Interactive Analysis
                  ├──► MCP Server ───► AI Agent Loop
                  ├──► PR Plugin ───► Team Adoption
                  └──► Health Badge ───► Viral Growth
```

### Rev-dep is fast but blind.
It gives you text in a terminal. You can't *see* your codebase.

### Fallow is smart but headless.
It has great analysis but no visualization.

### Knip is thorough but static.
It finds issues but doesn't show you the system.

### depxray is the only tool where you can:
1. **See** your codebase in an interactive graph
2. **Explore** impact with animated blast radius
3. **Monitor** health in a dashboard
4. **Equip** AI agents with 12+ targeted MCP tools
5. **Integrate** with PR workflows via plugins
6. **Share** visual snapshots with your team

That's not just a dependency analysis tool. That's a **codebase intelligence platform**.

---

## Open Questions

> [!IMPORTANT]

1. **Dashboard scope**: Should the health dashboard be a separate page/route (`/dashboard`), or a third center-column view alongside graph and Miller columns?

2. **MCP tool granularity**: Should `find_unused_exports` rescan the project each time, or cache the last scan result and serve from cache? Caching is faster but risks stale data.

3. **PR plugin**: Should `@depxray/plugin-github-pr` be a standalone npm package or a built-in plugin alias like `@depxray/plugin-complexity`?

4. **Blast-radius animation**: Simple color gradients (easiest), or animated ripple effects (most impressive)? Animated is more visually stunning but adds complexity.

5. **Plugin packaging**: Should new plugins live inside the monorepo as workspace packages, or as separate repositories?
