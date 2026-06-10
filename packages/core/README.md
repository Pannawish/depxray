# @depxray/core

Static dependency analysis engine for depxray.

`@depxray/core` scans JavaScript and TypeScript projects and returns structured dependency data for CLIs, browser tools, reports, automation, and AI coding agents. It powers the `depxray` CLI, browser UI, and `@depxray/mcp` server.

## What It Provides

- Dependency graphs for `.js`, `.jsx`, `.ts`, and `.tsx`
- Static imports, dynamic imports, CommonJS `require`, type-only imports, and re-exports
- `tsconfig.json` and `jsconfig.json` path alias resolution
- Circular dependency detection
- Orphan file detection with configurable entry points
- Unused export detection, including default exports, re-exports, barrel files, and type-only exports
- Unresolved local import detection
- Unused and unlisted npm dependency analysis
- DevDependencies-in-production detection from configured production entry points
- Monorepo workspace detection and cross-package edge metadata
- Workspace package `exports` and `imports` map resolution
- Per-file metrics: LOC, cyclomatic complexity, export count, and instability
- Lightweight architecture rule validation
- Entry-point-scoped restricted import rules
- Import convention detection and suggestions
- Graph diff helpers for snapshots and branch comparisons
- Plugin hooks for graph, scan, and report extensions

## Install

```bash
npm install @depxray/core
```

## Basic Usage

```ts
import { scanProject } from '@depxray/core';

const result = await scanProject({
  rootDir: '/path/to/project',
  detectCircular: true,
  detectUnusedDeps: true,
  prodEntryPoints: ['src/main.tsx', 'src/server.ts'],
  devEntryPoints: ['**/*.test.*', 'scripts/**'],
  ignoreTypeImports: true,
  importConventions: {
    prefer: 'absolute',
    aliasPrefix: '@/',
    root: 'src',
  },
  rules: [
    {
      from: 'src/ui/**',
      to: 'src/db/**',
      severity: 'error',
      message: 'UI cannot import DB modules directly',
    },
    {
      entryPoints: ['src/server.ts'],
      deny: { modules: ['react'], files: ['src/components/**'] },
      message: 'Server entry cannot import browser UI code',
    },
  ],
});

console.log(result.totalFiles);
console.log(result.graph.edges);
console.log(result.unresolvedImports);
console.log(result.devDepsInProd);
console.log(result.importConventionViolations);
console.log(result.ruleValidation);
```

## Graph Diffing

```ts
import { diffGraphs } from '@depxray/core';

const diff = diffGraphs(beforeGraphJson, afterGraphJson);

console.log(diff.addedFiles);
console.log(diff.removedEdges);
console.log(diff.addedCircularDependencies);
```

## Plugin Hooks

Plugins can mutate or return updated graph and scan data.

```ts
import type { DepxrayPlugin } from '@depxray/core';

export const plugin: DepxrayPlugin = {
  name: 'example-plugin',
  afterScan(result) {
    return {
      ...result,
      pluginData: {
        ...result.pluginData,
        example: { files: result.totalFiles },
      },
    };
  },
};
```

## Related Packages

- `depxray`: CLI, browser UI, reports, exports, graph diffing, and config-driven workflows
- `@depxray/mcp`: MCP server for AI coding agents

## Privacy

`@depxray/core` runs locally and performs static analysis on files you point it at. It does not send source code to depxray or any external depxray service.
