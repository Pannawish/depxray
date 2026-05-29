# React Dependency Graph

> Scan React projects, visualize import dependencies, detect circular dependencies — as a library, CLI, VS Code extension, or AI agent tool.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@rdg/core` | Platform-agnostic dependency graph scanner | 🏗️ v0.1 |
| `@rdg/cli` | CLI tool for terminal and AI agents | 🏗️ v0.2 |
| `react-dependency-graph` | VS Code extension with graph visualization | 🏗️ v0.3+ |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run the CLI
cd packages/cli && node dist/index.js scan /path/to/react-project

# Or use it as a library
import { scanProject } from '@rdg/core';
const result = await scanProject({ rootDir: './my-react-app' });
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
