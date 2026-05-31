# depxray (Dependency X-Ray)

Understand how a JavaScript or TypeScript codebase is wired together.

`depxray` scans your repository and shows structure, imports, dependents, and circular relationships in a local browser UI or machine-readable JSON. Use it to inspect one file, explore a large project, or generate a shareable static HTML report.

## Why depxray

- Explore a repo as a compact file tree instead of a noisy full-project graph
- See what a file imports and what depends on it
- Detect circular dependencies quickly
- Export JSON for scripts, automation, and coding agents
- Generate a standalone HTML report for local review or sharing

## Quick Start

Run it directly with `npx`:

```bash
npx depxray scan
```

Scan another project and open the local explorer:

```bash
npx depxray scan /path/to/project
```

Inspect one file:

```bash
npx depxray inspect src/components/Button.tsx
```

Export JSON:

```bash
npx depxray scan /path/to/project --json --mode dependencies --output dep-graph.json
```

Generate a standalone HTML bundle:

```bash
npx depxray scan /path/to/project --html
```

## For AI Agents

`depxray` is also designed for coding agents and automation workflows that need machine-readable repository structure and dependency data.

Common agent-oriented commands:

```bash
npx depxray scan /path/to/project --json
npx depxray inspect src/components/Button.tsx --format json
```

Use `scan --json` when an agent needs full project structure or dependency graph data. Use `inspect --format json` when an agent needs outgoing imports and incoming dependents for one file.

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
- `-o, --output <file>`: write JSON output to a file
- `--html`: generate a standalone HTML bundle in `.depxray/`
- `--mode <mode>`: `structure` or `dependencies`
- `--ignore <patterns...>`: exclude paths from scanning
- `--extensions <exts...>`: choose scanned extensions in dependency mode
- `--depth <depth>`: initial directory expansion depth
- `--port <port>`: local dashboard port
- `--no-open`: do not open the browser automatically

### `inspect`

Inspect what a file imports and what imports it.

```bash
depxray inspect <file> [options]
```

## Features

- File-tree-first repository explorer
- Incoming and outgoing file relationships
- Circular dependency detection
- JSON output for automation and AI workflows
- Standalone HTML export for sharing results
- Interactive local browser UI

## Repository

Source code, issues, and full documentation:

- GitHub: https://github.com/Pannawish/depxray

## License

MIT
