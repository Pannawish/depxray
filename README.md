# ⚛️ depxray

> A static analyzer and interactive explorer for JavaScript and TypeScript codebases, with support for React projects. Map imports, discover circular dependencies, and visualize your code structure from the command line or in the browser.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Pannawish%2Fdepxray-blue?logo=github)](https://github.com/Pannawish/depxray)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/badge/npm-0.3.0-red)](https://www.npmjs.com/package/depxray)

---

`depxray` is a developer tool for scanning JavaScript and TypeScript codebases and exploring their structure and module import graphs. It serves an interactive local dashboard to browse files, inspect import and export relationships, detect circular dependencies, and read file contents side-by-side.

It also supports CLI-only execution, with versioned JSON output for **AI coding agents** (such as Claude, Codex, and Antigravity) and standalone HTML exports.

---

## 📦 Monorepo Architecture

This project is organized as a TypeScript monorepo with three core workspaces:

| Workspace | Package Name | Role | Status |
|:---|:---|:---|:---|
| [`packages/core`](./packages/core) | `@depxray/core` | Core platform-agnostic scanner. Uses TypeScript AST compiler APIs to extract imports, map dependencies, and detect circular loops. | ✅ Core Engine |
| [`packages/web-ui`](./packages/web-ui) | `@depxray/web-ui` | React dashboard built with React Flow, multiple layouts, and an interactive file code viewer. | ✅ Visual client |
| [`packages/cli`](./packages/cli) | `depxray` | Publicly publishable binary bundle. It compiles all packages into a single-file, zero-dependency engine with the static Web UI fully embedded inside. | ✅ Single-file CLI |

---

## ✨ Features

- 📂 **Dual Visual Modes**:
  - **Structure Mode**: A structure explorer that represents directories and files as nested columns with file details, sizing metrics, and an inline code viewer.
  - **Dependency Mode**: An interactive module graph visualization (powered by React Flow) mapping how files import one another.
- 🔴 **Circular Loop Detection**: Scans for and highlights circular dependency chains in your code.
- ⇄ **Customizable Workspace Layout**:
  - **Horizontal Column Swapping**: Toggle or drag-and-drop the left Project Explorer and right panel columns to match your visual preference.
  - **Vertical Panel Swapping**: Flip the Selection Details panel and the Source Code viewer vertically using header grab-handles (`⋮⋮`) or swap buttons (`⇅`).
  - **Fluid Sizing Splitters**: Resize panels dynamically with draggable splitters.
- 🔍 **Interactive Code Viewer**: Read code directly inside the graph explorer with syntax highlighting.
- ⚡ **AI-Agent and CLI Friendly**: Outputs raw, versioned JSON graphs to standard output or outputs standalone zero-dependency static HTML bundles (`--html`) to host anywhere.

---

## 🚀 Quick Start

Ensure you have **Node.js >= 18** installed.

```bash
npx depxray scan

# Scan a specific target project
npx depxray scan /path/to/project

# Launch directly in Dependency Graph mode instead of Structure tree mode
npx depxray scan /path/to/project --mode dependencies
```

---

## 🛠️ CLI Reference

### 1. `scan` Command

Analyze a project directory and start a local browser server or export data.

```bash
npx depxray scan [dir] [options]
```

#### Arguments
- `[dir]`: Project directory to scan (default: `.`)

#### Options
| Option | Description |
|:---|:---|
| `--json` | Print the parsed graph JSON directly to `stdout`. |
| `-o, --output <file>` | Write JSON output to a file instead of `stdout` (requires `--json`). |
| `--html` | Generate a standalone HTML/JS dashboard bundle inside `.depxray/`. |
| `--mode <mode>` | Graph startup mode: `structure` or `dependencies` (default: `structure`). |
| `--ignore <patterns...>` | Additional file/directory glob patterns to exclude from scanning. |
| `--no-circular` | Deactivate circular dependency parsing in dependency mode (increases performance). |
| `--no-aliases` | Deactivate standard `tsconfig`/`jsconfig` path alias resolution. |
| `--extensions <exts...>` | File extensions to analyze in dependency mode (default: `.js`, `.jsx`, `.ts`, `.tsx`). |
| `--depth <depth>` | Default directory expand depth: `1`, `2`, `3`, `4`, or `all` (default: `2`). |
| `--port <port>` | Custom HTTP port for the local dashboard (default: `5178`). |
| `--no-open` | Start the local server without auto-opening the default web browser. |

#### Examples

```bash
# Export the entire import dependency graph to a JSON file
npx depxray scan /path/to/project --json --mode dependencies --output dep-graph.json

# Exclude specific vendor directories and custom files
npx depxray scan --ignore "**/vendor/**" "**/*.spec.ts"

# Generate a static dashboard folder you can host on Netlify/Vercel or share with your team
npx depxray scan --html
```

---

### 2. `inspect` Command

Inspect import/export relationships for a single file. Useful for quick CLI debugging or for passing focused context to AI assistants.

```bash
npx depxray inspect <file> [options]
```

#### Arguments
- `<file>`: File to inspect (relative or absolute path)

#### Options
| Option | Description |
|:---|:---|
| `-d, --dir <dir>` | Project root directory (default: `.`). |
| `-f, --format <format>` | Output format: `text` or `json` (default: `text`). |

#### Output Example (Text)

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

---

## 🏗️ Local Development

To clone, build, and test this project locally:

```bash
# 1. Clone the repository
git clone https://github.com/Pannawish/depxray.git
cd depxray

# 2. Install monorepo dependencies
npm install

# 3. Compile core parser and bundle static Web UI assets
npm run build

# 4. Run tests across all workspaces
npm run test

# 5. Run the CLI directly from source against any supported project
node packages/cli/dist/index.js scan /path/to/project
```

### Monorepo Workspaces Development

- Build individual workspaces:
  ```bash
  npm run build --workspace @depxray/core
  npm run build --workspace @depxray/web-ui
  npm run build --workspace depxray
  ```
- Run the visual client locally with hot-reloading:
  ```bash
  cd packages/web-ui
  npm run dev
  ```

---

## 📦 Packaging & Performance Notes

- **Zero Runtime Dependencies**: The CLI (`depxray`) is bundled into a single file `dist/index.js` using `esbuild`. It includes the `@depxray/core` parser logic directly, so users do not need a separate runtime package.
- **Embedded Web Assets**: The compiled HTML, CSS, and JS assets of `@depxray/web-ui` are bundled into `packages/cli/dist/web-ui/` during the build process, so the browser server serves them directly from disk without relying on third-party CDNs.
- **Tree-Shaken & Minified**: The published bundle stays relatively small (~1.9 MB including UI assets), which helps keep `npx` execution lightweight.

---

## License

[MIT](./LICENSE) — Created by **[Pannawish Kriengyakul](https://github.com/Pannawish)**.
