# 🛠️ Command-Line Interface (CLI) Reference

This document provides a comprehensive reference for using the `depxray` CLI tool. `depxray` is designed to be highly versatile, operating either as an interactive local visual explorer, a static HTML exporter, or an automated JSON parser for CI/CD pipelines and AI coding agents.

---

## 1. `scan` Command

Analyze a project directory. By default, it spins up a local web server and opens the interactive dashboard in your browser. It can also export the static schema as standard JSON or compile a standalone, self-contained HTML bundle.

### Usage

```bash
npx depxray scan [dir] [options]
# or if installed globally:
depxray scan [dir] [options]
```

### Arguments

- `[dir]`: The project directory to scan. Defaults to the current working directory (`.`).

### Options

| Option | Description |
|:---|:---|
| `--json` | Print the parsed graph JSON directly to standard output (`stdout`). Useful for piping into other utilities or sending structured context to AI agents. |
| `-o, --output <file>` | Write the scan results to a specific file (requires `--json` to write JSON or `--html` to write a static bundle). |
| `--html` | Generate a standalone, zero-dependency HTML/JS dashboard bundle inside `.depxray/`. Perfect for hosting on Vercel, Netlify, or sharing with team members. |
| `--mode <mode>` | The startup view of the dashboard. Options: `structure` or `dependencies`. (Default: `structure`). |
| `--ignore <patterns...>` | Additional file or directory glob patterns to exclude from analysis (e.g., `**/vendor/**`, `**/*.spec.ts`). |
| `--no-circular` | Deactivate circular dependency parsing. Recommended for extremely large codebases to speed up analysis. |
| `--no-aliases` | Deactivate standard `tsconfig`/`jsconfig` path alias resolution (e.g. mapping `@/*` paths). |
| `--extensions <exts...>` | File extensions to analyze (Default: `.js`, `.jsx`, `.ts`, `.tsx`). |
| `--depth <depth>` | Default folder expansion depth in Structure mode: `1`, `2`, `3`, `4`, or `all` (Default: `2`). |
| `--port <port>` | The custom HTTP port for the local dashboard server (Default: `5178`). |
| `--no-open` | Start the local server without auto-opening your default browser. |

### Concrete Examples

#### 1. Export the entire import dependency graph to a JSON file
Excellent for backup, automation scripts, or importing into other graph-analysis systems.
```bash
npx depxray scan /path/to/project --json --mode dependencies --output dep-graph.json
```

#### 2. Exclude vendor directories and test files
To focus strictly on your primary business logic, exclude third-party or ancillary files:
```bash
npx depxray scan --ignore "**/vendor/**" "**/*.spec.ts" "**/*.test.tsx"
```

#### 3. Build a standalone, self-contained visual report
Generates a static HTML folder inside `.depxray/` that requires zero NPM packages or running servers to operate. You can open `index.html` directly in any web browser.
```bash
npx depxray scan --html
```

---

## 2. `inspect` Command

Inspect import/export relationships for a single specific file. This is highly useful for quick terminal checks or supplying target context to LLM coding assistants.

### Usage

```bash
npx depxray inspect <file> [options]
```

### Arguments

- `<file>`: The path to the file to inspect (supports relative and absolute paths).

### Options

| Option | Description |
|:---|:---|
| `-d, --dir <dir>` | Specify the project root directory (Default: `.`). |
| `-f, --format <format>` | Output format. Options: `text` or `json` (Default: `text`). |

### Command Output Examples

#### 1. Human-Readable Text Format (Default)

Running `inspect` on a component prints a quick text visualization of its immediate imports and dependencies:

```bash
$ npx depxray inspect src/components/Button.tsx

  📄 src/components/Button.tsx
     Extension: .tsx
     Imports:   2 files
     Used by:   5 files

  📥 This file imports:
     → src/components/Icon.tsx { Icon }
     → src/styles/theme.ts (type-only)

  📤 Imported by:
     ← src/components/Form.tsx { Button }
     ← src/pages/Home.tsx { Button }
```

#### 2. Structured JSON Format

If you need programmatic consumption of a single file's relationship structure, use `-f json`:

```bash
$ npx depxray inspect src/components/Button.tsx -f json
```

```json
{
  "filePath": "src/components/Button.tsx",
  "extension": ".tsx",
  "imports": [
    {
      "resolvedPath": "src/components/Icon.tsx",
      "specifiers": ["Icon"],
      "typeOnly": false
    },
    {
      "resolvedPath": "src/styles/theme.ts",
      "specifiers": [],
      "typeOnly": true
    }
  ],
  "importedBy": [
    {
      "resolvedPath": "src/components/Form.tsx",
      "specifiers": ["Button"]
    },
    {
      "resolvedPath": "src/pages/Home.tsx",
      "specifiers": ["Button"]
    }
  ]
}
```
