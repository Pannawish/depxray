# depxray (Dependency X-Ray)

> A static analyzer and interactive explorer for JavaScript and TypeScript codebases, with support for React projects. Map imports, discover circular dependencies, and visualize your code structure from the command line or in the browser.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Pannawish%2Fdepxray-blue?logo=github)](https://github.com/Pannawish/depxray)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/badge/npm-0.3.0-red)](https://www.npmjs.com/package/depxray)

---

`depxray` is a developer tool for scanning JavaScript and TypeScript codebases and exploring their structure and module import graphs. It serves an interactive local dashboard to browse files, inspect import and export relationships, detect circular dependencies, and read file contents side-by-side.

It also supports CLI-only execution, with versioned JSON output for **AI coding agents** (such as Claude, Codex, and Antigravity) and standalone HTML exports.

---

## How to Use It (Quick Start)

You can run `depxray` immediately on any JavaScript or TypeScript project without installing it using `npx`:

```bash
# Scan the current directory and open the local interactive browser dashboard
npx depxray scan

# Scan a specific directory
npx depxray scan /path/to/project

# Launch directly in Dependency Graph mode instead of Structure tree mode
npx depxray scan /path/to/project --mode dependencies
```

Alternatively, you can install the CLI globally:

```bash
npm install -g depxray
depxray scan
```

> [!TIP]
> For a full list of scan arguments, exclusion filters, JSON outputs, and standalone HTML bundle generation, see the **[CLI Reference Guide](./docs/cli.md)**.

---

## Features

- **Dual Visual Modes**:
  - **Structure Mode**: A structure explorer that represents directories and files as nested columns with file details, sizing metrics, and an inline code viewer.
  - **Dependency Mode**: An interactive module graph visualization (powered by React Flow) mapping how files import one another.
- **Circular Loop Detection**: Scans for and highlights circular dependency chains in your code.
- **Customizable Workspace Layout**:
  - **Horizontal Column Swapping**: Toggle or drag-and-drop the left Project Explorer and right panel columns to match your visual preference.
  - **Vertical Panel Swapping**: Flip the Selection Details panel and the Source Code viewer vertically using header grab-handles (`⋮⋮`) or swap buttons (`⇅`).
  - **Fluid Sizing Splitters**: Resize panels dynamically with draggable splitters.
- **Interactive Code Viewer**: Read code directly inside the graph explorer with syntax highlighting.
- **AI-Agent and CLI Friendly**: Outputs raw, versioned JSON graphs to standard output or outputs standalone zero-dependency static HTML bundles (`--html`) to host anywhere.

---

## Monorepo Architecture

This project is organized as a TypeScript monorepo with three core workspaces:

| Workspace | Package Name | Role | Status |
|:---|:---|:---|:---|
| [`packages/core`](./packages/core) | `@depxray/core` | Core platform-agnostic scanner. Uses TypeScript AST compiler APIs to extract imports, map dependencies, and detect circular loops. | Core Engine |
| [`packages/web-ui`](./packages/web-ui) | `@depxray/web-ui` | React dashboard built with React Flow, multiple layouts, and an interactive file code viewer. | Visual client |
| [`packages/cli`](./packages/cli) | `depxray` | Publicly publishable binary bundle. It compiles all packages into a single-file, zero-dependency engine with the static Web UI fully embedded inside. | Single-file CLI |

---

## Documentation

- **[CLI Reference Guide](./docs/cli.md)**: Detailed explanations of all `scan` and `inspect` commands, arguments, option tables, and format outputs.
- **[Development & Contribution Guide](./docs/development.md)**: Local developer setup instructions, build steps, workspace management, and packaging pipeline highlights.

---

## License

[MIT](./LICENSE) — Created by **[Pannawish Kriengyakul](https://github.com/Pannawish)**.
