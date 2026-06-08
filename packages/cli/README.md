# depxray (Dependency X-Ray)

Understand a JavaScript or TypeScript codebase through an interactive graph view, file tree, imports, dependents, circular dependencies, JSON output, and static HTML reports.

`depxray` is a browser-first CLI for developers and AI coding agents that need repository context before editing code. It scans a project, builds structure and dependency data, and exposes that data through a local browser UI, machine-readable JSON, or a shareable static HTML export.

## Why depxray

- Explore a repo as a compact file tree instead of a noisy full-project graph
- Navigate an interactive force-directed graph for dependency and structure data
- See what a file imports and what depends on it
- Detect circular dependencies quickly
- Detect orphan files with no incoming imports
- Export JSON for scripts, automation, and AI coding agents
- Generate a standalone HTML report for local review or sharing

## Fastest Way To Try It

Run it directly with `npx`:

```bash
npx depxray scan
```

The default `scan` command starts a local browser UI. If port `5178` is busy, `depxray` automatically tries the next free port.

The browser UI opens with the graph view in the center panel. Use the toolbar to switch between **Graph** and **Miller** views. In graph view, you can zoom, pan, drag nodes, click nodes to select files, and switch label visibility between **Smart**, **All**, and **None**.

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

Inspect one file and show its imports and dependents:

```bash
npx depxray inspect src/components/Button.tsx --dir /path/to/project
```

Generate a standalone HTML report:

```bash
npx depxray scan /path/to/project --html
```

## For AI Agents

Use `depxray` before making edits when an agent needs project structure or file-level dependency context.

Typical workflow:

1. Run `scan --json` to get project structure or dependency graph data.
2. Run `inspect --format json` on the file the agent plans to edit.
3. Use incoming dependents and outgoing imports to avoid breaking connected files.

Agent-oriented commands:

```bash
npx depxray scan /path/to/project --mode dependencies --json --output dep-graph.json
npx depxray inspect src/components/Button.tsx --dir /path/to/project --format json
```

Use `scan --json` when an agent needs project-wide context. Use `inspect --format json` when an agent needs focused context for one file.

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
- `-o, --output <file>`: write JSON output to a file; only valid with `--json`
- `--html`: generate a standalone HTML bundle in `.depxray/`
- `--mode <mode>`: `structure` or `dependencies`
- `--ignore <patterns...>`: exclude paths from scanning
- `--no-circular`: skip circular dependency detection in dependency mode
- `--no-aliases`: skip `tsconfig.json` / `jsconfig.json` path alias resolution in dependency mode
- `--orphans`: print orphan files to `stderr` after dependency scanning
- `--entry-points <patterns...>`: glob patterns to exclude from orphan detection
- `--extensions <exts...>`: choose scanned extensions in dependency mode
- `--depth <depth>`: initial directory expansion depth; accepts any integer `>= 1` or `all`
- `--port <port>`: preferred local dashboard port; falls back to the next free port if needed
- `--no-open`: do not open the browser automatically

Examples:

```bash
depxray scan
depxray scan /path/to/project --mode dependencies
depxray scan /path/to/project --mode dependencies --json --output dep-graph.json
depxray scan /path/to/project --mode dependencies --orphans
depxray scan /path/to/project --mode dependencies --orphans --entry-points "src/routes/**" "src/bootstrap.ts"
depxray scan /path/to/project --html
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
- circular dependency detection
- orphan file detection with configurable entry point exclusions
- interactive force-directed dependency and structure graph visualization

## Repository

Source code, issues, and full documentation:

- GitHub: https://github.com/Pannawish/depxray

## License

MIT
