# 🏗️ Local Development & Contributing Guide

Thank you for your interest in developing and contributing to `depxray`! This document guides you through setting up your local environment, building the workspace, running tests, and understanding the project's build and packaging pipeline.

---

## 🚀 Setting Up the Project

Ensure you have **Node.js >= 18** and **npm** installed.

### 1. Clone the repository
```bash
git clone https://github.com/Pannawish/depxray.git
cd depxray
```

### 2. Install dependencies
Install monorepo dependencies and configure workspace packages symlinks:
```bash
npm install
```

### 3. Build all workspace projects
Compile the core TS parser and bundle the static visual client Web UI assets:
```bash
npm run build
```

### 4. Run tests
Execute tests across all monorepo workspaces:
```bash
npm run test
```

### 5. Run the CLI locally from source
Run the compiled CLI bundle directly from your disk against any target folder:
```bash
node packages/cli/dist/index.js scan /path/to/project
```

---

## 📦 Monorepo Workspaces

`depxray` is structured as a TypeScript monorepo using npm workspaces:

| Workspace | Directory | Package Name | Description |
|:---|:---|:---|:---|
| **Core Parser** | [`packages/core`](../packages/core) | `@depxray/core` | Core platform-agnostic AST dependency compiler. |
| **Web Dashboard** | [`packages/web-ui`](../packages/web-ui) | `@depxray/web-ui` | Interactive React dashboard built with React Flow. |
| **Binary Bundle** | [`packages/cli`](../packages/cli) | `depxray` | Single-file binary distribution including the embedded Web UI. |

### Development Workflow

During active development, compiling every package on change can be slow. Use these individual workflows:

#### 1. Developing the parser or CLI
Build individual workspaces directly:
```bash
# Build the core dependency scanner engine
npm run build --workspace @depxray/core

# Build the CLI wrapper
npm run build --workspace depxray
```

#### 2. Developing the visual dashboard (Web UI)
To iterate rapidly on the React dashboard with hot-reloading:
```bash
cd packages/web-ui
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. This dev server runs with Mock/Sample data or connects to your workspace.

---

## ⚡ Packaging & Performance Highlights

To keep `depxray` extremely fast, easy to install, and zero-dependency for end-users, the build pipeline follows several key constraints:

- **Zero Runtime Dependencies**: The published `depxray` package has **no runtime node_modules**. Everything is bundled into a single file `dist/index.js` using `esbuild`. The parser and AST logic are compiled directly into this target bundle.
- **Embedded Web Assets**: The React dashboard compiled assets (`packages/web-ui/dist/`) are read and injected directly into `packages/cli/dist/web-ui/` during the build process. When the CLI starts a server, it streams the embedded assets directly from the filesystem—no internet connection or external CDN required.
- **Tree-Shaken and Minified**: The total NPM package size is kept extremely lightweight (~1.9 MB including the full interactive dashboard), ensuring that running `npx depxray scan` downloads and launches in seconds.
