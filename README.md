# React Dependency Graph

> Scan React projects and explore structure and dependency graphs in the browser, CLI, or JSON exports for AI agents.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@rdg/core` | Platform-agnostic structure and dependency scanner | ✅ structure + dependency modes |
| `@rdg/cli` | Browser-first CLI for graph exploration, JSON, and static export | ✅ dual-mode session |
| `@rdg/web-ui` | Standalone React Flow UI bundled into the CLI build | ✅ structure + dependency views |

## ✨ Current Features

- `rdg scan` opens a local browser session with structure and dependency modes available in one UI.
- `rdg scan --json` emits a stable versioned graph payload for the selected mode.
- `rdg scan --html` writes a standalone `.react-dependency-graph/` export with embedded data.
- Dependency mode highlights circular modules and supports type-only, dynamic, and circular-only filters.

## 🚀 Quick Start

```bash
# Install dependencies and build all workspaces
npm install
npm run build

# Open the browser UI for a project
node packages/cli/dist/index.js scan /path/to/react-project

# Start directly in dependency mode
node packages/cli/dist/index.js scan /path/to/react-project --mode dependencies

# Export a standalone HTML report
node packages/cli/dist/index.js scan /path/to/react-project --html

# Or use it as a library
import { scanFileTree, buildStructureGraph } from '@rdg/core';
const tree = await scanFileTree('./my-react-app');
const graph = buildStructureGraph(tree);
```

## 🏗️ Development

```bash
# Build everything
npm run build

# Run tests
npm test

# Watch mode for core development
cd packages/core && npm run dev
```

## 📖 Documentation

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for the full architecture, roadmap, and implementation guide.

## 📦 Packaging Notes

- The CLI build now bundles the compiled web UI into `packages/cli/dist/web-ui/`.
- The built CLI entrypoint is bundled into a single `dist/index.js`, so published installs do not require a separate `@rdg/core` package at runtime.
- Browser mode and static export no longer depend on `packages/web-ui/dist` at runtime when using the built CLI package.
- The intended public package name is `react-dependency-graph`, which supports `npx react-dependency-graph`.

## License

MIT
