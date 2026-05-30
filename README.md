# React Dependency Graph

> Scan React projects and explore structure and dependency graphs in the browser, CLI, or JSON exports for AI agents.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@rdg/core` | Platform-agnostic structure and dependency scanner | ✅ structure + dependency modes |
| `react-dependency-graph` | Browser-first CLI for graph exploration, JSON, and static export | ✅ dual-mode session |
| `@rdg/web-ui` | Standalone React Flow UI bundled into the CLI build | ✅ structure + dependency views |

## ✨ Current Features

- `npx react-dependency-graph scan` opens a local browser session with structure and dependency modes available in one UI.
- `npx react-dependency-graph scan --json` emits a stable versioned graph payload for the selected mode.
- `npx react-dependency-graph scan --html` writes a standalone `.react-dependency-graph/` export with embedded data.
- Dependency mode highlights circular modules and supports type-only, dynamic, and circular-only filters.

## 🚀 Quick Start

```bash
# After publish
npx react-dependency-graph scan /path/to/react-project
npx react-dependency-graph scan /path/to/react-project --mode dependencies
npx react-dependency-graph scan /path/to/react-project --json
npx react-dependency-graph scan /path/to/react-project --html
```

## 🏗️ Local Development

```bash
# Build everything
npm install
npm run build

# Run from this repo
node packages/cli/dist/index.js scan /path/to/react-project

# Test the publishable package locally
cd packages/cli
npm pack
npm exec --package=./react-dependency-graph-0.1.0.tgz -- react-dependency-graph scan /path/to/react-project
```

## 📚 Library Usage

```typescript
import { scanFileTree, buildStructureGraph } from '@rdg/core';

const tree = await scanFileTree('./my-react-app');
const graph = buildStructureGraph(tree);
```

## 📖 Documentation

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for the full architecture, roadmap, and implementation guide.

## 📦 Packaging Notes

- The CLI build now bundles the compiled web UI into `packages/cli/dist/web-ui/`.
- The built CLI entrypoint is bundled into a single `dist/index.js`, so published installs do not require a separate `@rdg/core` package at runtime.
- Browser mode and static export no longer depend on `packages/web-ui/dist` at runtime when using the built CLI package.
- The public package name is `react-dependency-graph`, which supports `npx react-dependency-graph`.

## License

MIT
