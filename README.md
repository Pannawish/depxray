# React Dependency Graph

> Scan React projects and explore project structure graphs in the browser, from the CLI, or as structured data for AI agents.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@rdg/core` | Platform-agnostic structure and dependency scanner | 🏗️ v0.1 |
| `@rdg/cli` | Browser-first CLI for structure graphs and exports | 🏗️ v0.3 |
| `@rdg/web-ui` | Standalone React Flow UI served by the CLI | 🏗️ v0.2 |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run the CLI
cd packages/cli && node dist/index.js scan /path/to/react-project

# Or use it as a library
import { scanFileTree, buildStructureGraph } from '@rdg/core';
const tree = await scanFileTree('./my-react-app');
const graph = buildStructureGraph(tree);
```

## 🏗️ Development

```bash
# Install all workspace dependencies
npm install

# Build everything
npm run build

# Run tests
npm test

# Watch mode for core development
cd packages/core && npm run dev
```

## 📖 Documentation

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for the full architecture, roadmap, and implementation guide.

## License

MIT
