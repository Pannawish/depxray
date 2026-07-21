# depxray (Dependency X-Ray)

Understand a JavaScript or TypeScript codebase through an interactive graph view, health dashboard, file tree, imports, dependents, circular dependencies, JSON output, and static HTML reports.

`depxray` is a browser-first CLI for developers and AI coding agents that need repository context before editing code. It scans a project, builds structure, dependency, health, and cleanup data, and exposes that context through a local browser UI, machine-readable JSON, or a shareable static HTML export.

For MCP-compatible AI clients, use the companion package `@depxray/mcp`.

## Why depxray

- Explore a repo as a compact file tree instead of a noisy full-project graph
- Navigate an interactive graph with focused layouts and drill-down scopes
- Review a health dashboard with an explainable score, grade, issue counts, complexity hotspots, and dependency hubs
- Color graph nodes by extension, complexity, file size, or instability
- See what a file imports and what depends on it
- Analyze a file's direct and transitive dependency impact before refactors
- Review file health metrics such as LOC, complexity, exports, and instability
- Detect circular dependencies quickly
- Detect orphan files with no incoming imports
- Detect unused exports, including barrel and re-export chains
- Detect unresolved local imports while ignoring external packages and common assets
- Apply safe autofixes with dry-run and confirmation controls
- Detect devDependencies used from production entry point trees
- Detect unused and unlisted npm dependencies
- Detect workspace ownership and cross-package imports in monorepos
- Validate dependency edges against lightweight architecture rules
- Enforce entry-point-scoped restricted imports
- Enforce and autofix import conventions
- Resolve workspace package `exports` and `imports` maps
- Run CI checks with non-zero exit codes
- Export SARIF for code scanning integrations
- Explore entry points, reverse reachability, and transitive import trees
- Extend scans and reports with config-driven plugins and hooks
- Diff dependency graph snapshots or compare a git base ref against the working tree
- Format dependency graph diffs for GitHub PR comments through the built-in PR plugin
- Export JSON for scripts, automation, and AI coding agents
- Export Mermaid and DOT dependency graphs for docs and PRs
- Generate Markdown project health reports
- Generate a standalone HTML report for local review or sharing

## Fastest Way To Try It

Run it directly with `npx`:

```bash
npx depxray scan
```

The default `scan` command starts a local browser UI. If port `5178` is busy, `depxray` automatically tries the next free port.

The browser UI opens with the graph view in the center panel. A prominent **Center view** control switches between **Graph**, **Miller**, and **Dashboard**. In graph view, selecting a file automatically opens a dependency neighborhood; selecting a folder opens its aggregated boundary graph. Stable layouts present file relationships as Dependents → Selected → Dependencies, organize folder boundaries around their internal files, and summarize project dependencies as top-level clusters.

Quick presets provide Overview, Direct relationships, Full neighborhood, Circular dependencies, Architecture violations, and High-impact files. Large scopes start with an 80-node rendering budget and collapse excess files into drillable folder groups. Hovering or selecting a node fades unrelated content, while directional arrows are reserved for emphasized relationships. Smart labels prioritize selected files, folders, and hubs, and become smaller at close zoom. Type-only and dynamic imports are hidden initially and can be enabled from the graph controls.

The graph also provides Project/Folder/File scope controls, breadcrumbs, direct/two-level/complete neighborhoods, internal/incoming/outgoing folder filters, shortest dependency-path highlighting, right-click node actions, zoom, pan, blast-radius highlighting, label visibility controls, health-metric coloring, unused-export filters, and unresolved-import details.

The Dashboard includes an information button beside the project score. It explains the current scan's `100 - deductions = score` calculation, observed issue values, capped deduction rules, architecture-rule errors, average-complexity penalty, and A-F grade thresholds. Reports created before the structured breakdown was added remain readable and prompt the user to rescan for the detailed calculation.

## Quick Examples

Open the current project in the browser UI:

```bash
npx depxray scan
```

Scan another project and open the local explorer:

```bash
npx depxray scan /path/to/project
```

Export dependency data to JSON:

```bash
npx depxray scan /path/to/project --mode dependencies --json --output dep-graph.json
```

Print orphan files:

```bash
npx depxray scan /path/to/project --mode dependencies --orphans
```

Print unused exports:

```bash
npx depxray scan /path/to/project --mode dependencies --unused-exports
```

Print unresolved local imports:

```bash
npx depxray scan /path/to/project --mode dependencies --unresolved
```

Preview safe autofixes:

```bash
npx depxray scan /path/to/project --fix --dry-run
```

Run all CI checks:

```bash
npx depxray check /path/to/project
```

Export SARIF:

```bash
npx depxray scan /path/to/project --mode dependencies --json --format sarif --output depxray.sarif
```

Trace entry point reachability:

```bash
npx depxray entry-points /path/to/project
npx depxray trace src/utils/math.ts /path/to/project
npx depxray tree src/main.ts /path/to/project --json
```

Analyze refactor impact:

```bash
npx depxray impact src/utils/math.ts /path/to/project
npx depxray impact src/utils/math.ts /path/to/project --json
```

Find unused and unlisted npm dependencies:

```bash
npx depxray scan /path/to/project --mode dependencies --deps --json
```

Validate imports against architecture rules:

```bash
npx depxray scan /path/to/project --mode dependencies --validate
```

Inspect one file and show its imports and dependents:

```bash
npx depxray inspect src/components/Button.tsx --dir /path/to/project
```

Generate a standalone HTML report:

```bash
npx depxray scan /path/to/project --html
```

Generate a Markdown health report:

```bash
npx depxray report /path/to/project --output depxray-report.md
```

Keep the browser UI updated while editing files:

```bash
npx depxray scan /path/to/project --watch
```

Create a reusable project config:

```bash
npx depxray init /path/to/project --defaults
```

## For AI Agents

Use `depxray` before making edits when an agent needs project structure or file-level dependency context.

Typical workflow:

1. Run `scan --json` to get project structure or dependency graph data.
2. Run `scan --mode dependencies --unused-exports --json` to find removable exports.
3. Run `scan --mode dependencies --unresolved --json` to find broken local references.
4. Run `inspect --format json` on the file the agent plans to edit.
5. Run `impact --json` on files the agent plans to modify.
6. Use incoming dependents, outgoing imports, and impact paths to avoid breaking connected files.

Agent-oriented commands:

```bash
npx depxray scan /path/to/project --mode dependencies --json --output dep-graph.json
npx depxray scan /path/to/project --mode dependencies --unused-exports --json --output dep-unused-exports.json
npx depxray scan /path/to/project --mode dependencies --unresolved --json --output dep-unresolved.json
npx depxray scan /path/to/project --mode dependencies --deps --json --output dep-graph.json
npx depxray scan /path/to/project --mode dependencies --validate
npx depxray scan /path/to/project --mode dependencies --json --format sarif --output depxray.sarif
npx depxray check /path/to/project --json
npx depxray tree src/main.ts /path/to/project --json
npx depxray impact src/components/Button.tsx /path/to/project --json
npx depxray diff --base main --json --dir /path/to/project
npx depxray inspect src/components/Button.tsx --dir /path/to/project --format json
npx depxray report /path/to/project --output depxray-report.md
```

Use `scan --json` when an agent needs project-wide context. Use `scan --unused-exports --json` when an agent should identify dead exports before refactoring. Use `scan --unresolved --json` when an agent should repair broken local imports. Use `impact --json` when an agent should estimate blast radius and refactor risk for a specific file. Use `scan --deps --json` when an agent should check package.json drift before installing or removing dependencies. Use `scan --validate` when an agent should respect architecture boundaries before editing. Use `diff --base main --json` when an agent should summarize dependency changes in a branch. Use `inspect --format json` when an agent needs focused context for one file. Use `report` when an agent or reviewer needs a compact Markdown health summary.

For clients that support MCP, configure the dedicated server package instead:

```json
{
  "mcpServers": {
    "depxray": {
      "command": "npx",
      "args": ["--package", "@depxray/mcp", "depxray-mcp"]
    }
  }
}
```

The MCP server exposes project scanning, file inspection, impact analysis, health scoring, unused export lookup, dependency-chain explanations, related-file lookup, cleanup suggestions, graph diffs, circular dependency detection, orphan detection, file-tree retrieval, and folder summaries as callable tools, with results including unused export, unresolved import, cleanup, health, and refactor-risk metadata.

## JSON Output Examples

The examples below are shortened to show the stable shape. Real output includes full `nodes` and `edges` arrays.

`scan --mode dependencies --json` returns graph data like:

```json
{
  "schemaVersion": "1.0.0",
  "mode": "dependencies",
  "projectRoot": "/path/to/project",
  "totalFiles": 42,
  "totalImports": 87,
  "circularCount": 2,
  "orphanFiles": ["src/legacy/UnusedView.tsx"],
  "nodes": [],
  "edges": []
}
```

`inspect --format json` returns file-level dependency data like:

```json
{
  "file": "src/App.tsx",
  "extension": ".tsx",
  "inDegree": 3,
  "outDegree": 5,
  "isCircular": false,
  "imports": [
    {
      "file": "src/components/Header.tsx",
      "specifier": "./components/Header",
      "names": ["Header"],
      "isTypeOnly": false,
      "isDynamic": false
    }
  ],
  "importedBy": []
}
```

## Install

Use it directly with `npx`:

```bash
npx depxray scan
```

Or install it globally:

```bash
npm install -g depxray
depxray scan
```

## Commands

### `scan`

Analyze a project directory and start a local browser server or export data.

```bash
depxray scan [dir] [options]
```

Common options:

- `--json`: print graph data to `stdout`
- `-o, --output <file>`: write output to a file; only valid with `--json`
- `--html`: generate a standalone HTML bundle in `.depxray/`
- `--mode <mode>`: `structure` or `dependencies`
- `--format <format>`: `json`, `mermaid`, or `dot`; Mermaid/DOT require `--mode dependencies --json`
- `--format sarif`: export dependency findings as SARIF; requires `--mode dependencies --json`
- `--ignore <patterns...>`: exclude paths from scanning
- `--no-circular`: skip circular dependency detection in dependency mode
- `--no-aliases`: skip `tsconfig.json` / `jsconfig.json` path alias resolution in dependency mode
- `--orphans`: print orphan files to `stderr` after dependency scanning
- `--unused-exports`: print unused export findings to `stderr` after dependency scanning
- `--unresolved`: print unresolved local imports to `stderr` after dependency scanning
- `--deps`: include unused and unlisted npm dependency analysis in dependency JSON
- `--validate`: validate dependency edges against architecture rules from config
- `--fix`: apply safe autofixes for unused exports, orphan files, configured import conventions, and unused npm dependencies when combined with `--deps`
- `--dry-run`: show autofix actions without modifying files
- `--yes`: apply autofixes without prompting
- `--prod-entry-points <patterns...>`: production entry points for devDependency checks
- `--dev-entry-points <patterns...>`: development-only entry points for devDependency checks
- `--ignore-type-imports`: ignore type-only imports for devDependency checks
- `--entry-points <patterns...>`: glob patterns to exclude from orphan detection
- `--extensions <exts...>`: choose scanned extensions in dependency mode
- `--depth <depth>`: initial directory expansion depth; accepts any integer `>= 1` or `all`
- `--port <port>`: preferred local dashboard port; falls back to the next free port if needed
- `--watch`: watch project files and update the browser UI live
- `--no-open`: do not open the browser automatically

Examples:

```bash
depxray scan
depxray scan /path/to/project --mode dependencies
depxray scan /path/to/project --mode dependencies --json --output dep-graph.json
depxray scan /path/to/project --mode dependencies --json --format mermaid --output graph.mmd
depxray scan /path/to/project --mode dependencies --json --format dot --output graph.dot
depxray scan /path/to/project --mode dependencies --json --format sarif --output depxray.sarif
depxray scan /path/to/project --mode dependencies --orphans
depxray scan /path/to/project --mode dependencies --unused-exports
depxray scan /path/to/project --mode dependencies --unresolved
depxray scan /path/to/project --fix --dry-run
depxray scan /path/to/project --fix --deps --dry-run
depxray scan /path/to/project --mode dependencies --deps --json
depxray scan /path/to/project --mode dependencies --validate
depxray scan /path/to/project --mode dependencies --orphans --entry-points "src/routes/**" "src/bootstrap.ts"
depxray scan /path/to/project --html
depxray scan /path/to/project --watch
```

### `inspect`

Inspect what a file imports and what imports it.

```bash
depxray inspect <file> [options]
```

Options:

- `-d, --dir <dir>`: project root directory, default `.`
- `-f, --format <format>`: `text` or `json`, default `text`

Examples:

```bash
depxray inspect src/App.tsx --dir /path/to/project
depxray inspect src/App.tsx --dir /path/to/project --format json
```

### `impact`

Analyze which files directly or transitively depend on a target file, including sample paths, complexity metrics, and high-impact/high-complexity risk signals.

```bash
depxray impact <file> [dir] [options]
```

Options:

- `--json`: print machine-readable JSON
- `--format <format>`: `text` or `json`, default `text`
- `--complexity-threshold <number>`: complexity score considered high
- `--impact-threshold <number>`: transitive dependent count considered high-impact
- `--inbound-threshold <number>`: incoming import count considered high-impact
- `--ignore <patterns...>`: exclude paths from scanning
- `--no-circular`: skip circular dependency detection
- `--no-aliases`: skip `tsconfig.json` / `jsconfig.json` path alias resolution
- `--extensions <exts...>`: choose scanned extensions

Examples:

```bash
depxray impact src/App.tsx /path/to/project
depxray impact src/App.tsx /path/to/project --json
```

### `report`

Generate a Markdown project health report with summary counts, hub files, heavy importers, orphan files, unused exports, unresolved imports, circular chains, complexity hotspots, devDependencies used in production, and import-convention violations.

```bash
depxray report [dir] [options]
```

Options:

- `-o, --output <file>`: write the Markdown report to a file instead of `stdout`
- `--ignore <patterns...>`: exclude paths from scanning
- `--no-circular`: skip circular dependency detection
- `--no-aliases`: skip `tsconfig.json` / `jsconfig.json` path alias resolution
- `--entry-points <patterns...>`: glob patterns to exclude from orphan detection
- `--extensions <exts...>`: choose scanned extensions

Examples:

```bash
depxray report /path/to/project
depxray report /path/to/project --output depxray-report.md
```

### `check`

Run all configured dependency health checks for CI. The command exits with code `1` when findings are present.

```bash
depxray check [dir] [options]
```

Options:

- `--format <format>`: `text` or `json`, default `text`
- `--json`: print machine-readable JSON
- `--base <ref>`: compare with a Git ref and fail only for newly introduced findings
- `--max-health-drop <points>`: fail when the health score drops more than the allowed amount; requires `--base`
- `--ignore <patterns...>`: exclude paths from scanning
- `--extensions <exts...>`: choose scanned extensions
- `--entry-points <patterns...>`: entry point patterns to exclude from orphan detection
- `--prod-entry-points <patterns...>`: production entry points for devDependency checks
- `--dev-entry-points <patterns...>`: development-only entry points for devDependency checks
- `--ignore-type-imports`: ignore type-only imports for devDependency checks
- `--no-circular`: skip circular dependency detection
- `--no-aliases`: skip `tsconfig.json` / `jsconfig.json` path alias resolution

Examples:

```bash
depxray check /path/to/project
depxray check /path/to/project --json
depxray check /path/to/project --base origin/main --max-health-drop 3
```

Use `--base <git-ref>` to keep inherited findings visible while failing CI only for new issues. `--max-health-drop <points>` optionally caps health-score regression from that baseline.

### `entry-points`, `trace`, and `tree`

Explore entry points and dependency reachability.

```bash
depxray entry-points /path/to/project
depxray trace src/utils/math.ts /path/to/project
depxray tree src/main.ts /path/to/project --json
```

### `diff`

Compare two dependency graph JSON snapshots, or compare a git base ref against the current working tree.

```bash
depxray diff [before.json] [after.json] [options]
```

Options:

- `--json`: print machine-readable diff JSON
- `--base <ref>`: scan the project at a git ref and compare it with the working tree
- `-d, --dir <dir>`: project directory for `--base`, default `.`

Examples:

```bash
depxray scan /path/to/project --mode dependencies --json --output before.json
depxray scan /path/to/project --mode dependencies --json --output after.json
depxray diff before.json after.json
depxray diff --base main --dir /path/to/project
depxray diff --base main --json
```

### `init`

Create a `depxray.config.js` file with commented defaults.

```bash
depxray init [dir] [options]
```

Options:

- `--defaults`: create the default config without prompts
- `--force`: overwrite an existing `depxray.config.js`

## Configuration

`depxray scan` reads config from the project root. CLI flags override config values.

Supported locations, in order:

1. `depxray.config.js`
2. `depxray.config.mjs`
3. `.depxrayrc.json`
4. `depxray` key in `package.json`

Example:

```js
module.exports = {
  mode: 'dependencies',
  ignore: ['dist', 'coverage'],
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  entryPoints: ['**/index.*', '**/main.*', '**/App.*'],
  circular: true,
  aliases: true,
  port: 5178,
  depth: 2,
  rules: [
    {
      from: 'src/ui/**',
      to: 'src/db/**',
      severity: 'error',
      message: 'UI cannot import DB modules directly',
    },
    {
      entryPoints: ['src/server.ts'],
      deny: { files: ['src/components/**'], modules: ['react'] },
      message: 'Server entry cannot import browser UI code',
    },
  ],
  prodEntryPoints: ['src/main.tsx', 'src/server.ts'],
  devEntryPoints: ['**/*.test.*', 'scripts/**'],
  ignoreTypeImports: true,
  importConventions: {
    prefer: 'absolute',
    aliasPrefix: '@/',
    root: 'src',
  },
  plugins: [
    '@depxray/plugin-complexity',
    '@depxray/plugin-mcp',
    '@depxray/plugin-github-pr',
    './depxray-plugin.mjs',
  ],
};
```

Supported fields: `ignore`, `extensions`, `entryPoints`, `mode`, `circular`, `aliases`, `port`, `depth`, `rules`, `prodEntryPoints`, `devEntryPoints`, `ignoreTypeImports`, `importConventions`, and `plugins`.

Example plugin module:

```js
export function afterScan(result) {
  return {
    ...result,
    pluginData: {
      ...result.pluginData,
      customSummary: { files: result.totalFiles },
    },
  };
}
```

Built-in plugin aliases are resolved by `depxray` itself and do not require installing separate npm packages:

- `@depxray/plugin-complexity`: adds scan-level complexity summary metadata
- `@depxray/plugin-mcp`: adds MCP-oriented tool and scan summary metadata for agent workflows; use `@depxray/mcp` when you need the actual MCP server
- `@depxray/plugin-github-pr`: formats dependency graph diffs as Markdown suitable for GitHub PR comments

## Supported Analysis

`depxray` performs static analysis for JavaScript and TypeScript projects.

It supports:

- `.js`, `.jsx`, `.ts`, `.tsx`
- static imports
- named imports
- namespace imports
- type-only imports
- dynamic imports
- CommonJS `require`
- re-exports and barrel files
- `tsconfig.json` and `jsconfig.json` path alias resolution
- project config via `depxray.config.js`, `depxray.config.mjs`, `.depxrayrc.json`, or `package.json`
- circular dependency detection
- orphan file detection with configurable entry point exclusions
- unused export detection with barrel and re-export support
- unresolved local import detection
- dependency impact analysis for direct and transitive dependents
- autofix dry-runs and safe source rewrites
- unused and unlisted npm dependency detection
- devDependency usage detection from production entry point trees
- monorepo workspace metadata and cross-package dependency detection
- package.json `exports` and `imports` map resolution for workspaces
- architecture rule validation with browser-highlighted violating edges
- entry-point-scoped restricted import rules
- import convention detection and autofix suggestions
- plugin hooks for extending graph metadata, scan metadata, and report data
- dependency graph diffing for files, edges, and circular dependency changes
- CI check command and SARIF output
- entry-point, trace, and transitive tree analysis commands
- dependency impact and refactor blast-radius analysis
- per-file LOC, cyclomatic complexity, export count, and instability metrics
- project health scoring and Markdown health reports with hub files, heavy importers, orphans, circular chains, and complexity hotspots
- interactive dependency and structure graph visualization with deterministic scoped layouts, presets, semantic labels, and folder aggregation
- browser Health Dashboard and graph heatmap overlays
- watch mode with live browser UI updates

## Repository

Source code, issues, and full documentation:

- GitHub: https://github.com/Pannawish/depxray

## License

MIT
