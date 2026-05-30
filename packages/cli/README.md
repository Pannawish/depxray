# depxray

Analyze JavaScript and TypeScript codebases with an interactive dependency graph and structure explorer.

`depxray` is a CLI tool for scanning project structure and module import graphs. It can open a local browser UI, print JSON output, export a standalone HTML bundle, and inspect import relationships for a single file.

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

## Quick Start

Scan the current project and open the local dashboard:

```bash
npx depxray scan
```

Scan a specific project:

```bash
npx depxray scan /path/to/project
```

Start in dependency mode:

```bash
npx depxray scan /path/to/project --mode dependencies
```

Export JSON:

```bash
npx depxray scan /path/to/project --json --mode dependencies --output dep-graph.json
```

Generate a standalone HTML bundle:

```bash
npx depxray scan --html
```

Inspect a single file:

```bash
npx depxray inspect src/components/Button.tsx
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

Inspect import and export relationships for a single file.

```bash
depxray inspect <file> [options]
```

## Features

- Structure explorer for directories and files
- Dependency graph view for module relationships
- Circular dependency detection
- JSON output for automation and AI workflows
- Standalone HTML export for sharing results
- Interactive local browser UI

## Repository

Source code, issues, and full documentation:

- GitHub: https://github.com/Pannawish/depxray

## License

MIT
