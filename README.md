# ⚛️ depxray

> A browser-first static analyzer and interactive explorer for JavaScript and TypeScript codebases, with first-class React support. Map imports, discover circular dependencies, and visualize your code structure with zero configuration.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Pannawish%2Fdepxray-blue?logo=github)](https://github.com/Pannawish/depxray)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/badge/npm-0.1.0-red)](https://www.npmjs.com/package/depxray)

---

`depxray` is a highly-optimized developer tool that scans JavaScript and TypeScript codebases for physical structure and module import graphs. It serves an interactive local dashboard to explore files, view import/export relationships, detect circular dependencies, and inspect file contents side-by-side.

It also supports CLI-only execution, producing clean versioned JSON output tailored for **AI Coding Agents** (such as Claude, Codex, and Antigravity) or fully static standalone HTML exports.

---

## 📦 Monorepo Architecture

This project is built as a highly modular TypeScript monorepo with three core workspaces:

| Workspace | Package Name | Role | Status |
|:---|:---|:---|:---|
| [`packages/core`](./packages/core) | `@depxray/core` | Core platform-agnostic scanner. Uses TypeScript AST compiler APIs to extract imports, map dependencies, and detect circular loops. | ✅ Core Engine |
| [`packages/web-ui`](./packages/web-ui) | `@depxray/web-ui` | High-fidelity React dashboard built with Custom HSL themes, React Flow, dynamic layouts, and an interactive file code viewer. | ✅ Rich visual client |
| [`packages/cli`](./packages/cli) | `depxray` | Publicly publishable binary bundle. It compiles all packages into a single-file, zero-dependency engine with the static Web UI fully embedded inside. | ✅ Single-file CLI |

---

## ✨ Features

- 📂 **Dual Visual Modes**:
  - **Structure Mode**: A spatial explorer representing directories and files as nested columns with file details, sizing metrics, and an inline code viewer.
  - **Dependency Mode**: An interactive module graph visualization (powered by React Flow) mapping how files import one another.
- 🔴 **Circular Loop Detection**: Instantly scans and highlights circular dependency chains in your code with high-contrast UI alerts.
- ⇄ **Fully Customizable Workspace Layout**:
  - **Horizontal Column Swapping**: Toggle or drag-and-drop the left Project Explorer and right panel columns to match your visual preference.
  - **Vertical Panel Swapping**: Flip the Selection Details panel and the Source Code viewer vertically using active header grab-handles (`⋮⋮`) or low-profile swap buttons (`⇅`).
  - **Fluid Sizing Splitters**: Drag and scale panels dynamically with elegant, HSL-glowing accent resizing bars.
- 🔍 **Interactive Code Viewer**: Read full-screen code directly inside the graph explorer with beautiful syntax highlighting.
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

Analyze a project directory and spin up a browser server or export data.

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
| `--html` | Generate a fully standalone HTML/JS dashboard bundle inside `.depxray/`. |
| `--mode <mode>` | Graph startup mode: `structure` or `dependencies` (default: `structure`). |
| `--ignore <patterns...>` | Additional file/directory glob patterns to exclude from scanning. |
| `--no-circular` | Deactivate circular dependency parsing in dependency mode (increases performance). |
| `--no-aliases` | Deactivate standard `tsconfig`/`jsconfig` path alias resolution. |
| `--extensions <exts...>` | File extensions to analyze in dependency mode (default: `.js`, `.jsx`, `.ts`, `.tsx`). |
| `--depth <depth>` | Default directory expand depth: `1`, `2`, `3`, `4`, or `all` (default: `2`). |
| `--port <port>` | Custom HTTP port to host the interactive local dashboard on (default: `5178`). |
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

Inspect import/export relationships for a single file. Perfect for quick CLI debugging or feeding specific context to AI assistants.

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

- **Zero-Dependency at Runtime**: The CLI (`depxray`) is bundled into a single file `dist/index.js` using `esbuild`. It includes all `@depxray/core` parser logic directly, so users do not need a separate download at runtime.
- **Embedded Web Assets**: The compiled HTML, CSS, and JS assets of `@depxray/web-ui` are fully bundled into `packages/cli/dist/web-ui/` during the build process, meaning the browser server serves entirely from disk and requires **no internet connection** or third-party CDN fetch.
- **Tree-Shaken & Minified**: Code size remains extremely small (~1.9 MB including full icons and UI assets), enabling extremely fast `npx` execution.

---

## License

[MIT](./LICENSE) — Created by **[Pannawish Kriengyakul](https://github.com/Pannawish)**.
