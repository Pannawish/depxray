# @depxray/core

Static dependency analysis engine for depxray.

`@depxray/core` scans JavaScript and TypeScript projects and returns structured dependency, health, impact, cleanup, and graph-diff data for CLIs, browser tools, reports, automation, and AI coding agents. It powers the `depxray` CLI, browser UI, and `@depxray/mcp` server.

## What It Provides

- Dependency graphs for `.js`, `.jsx`, `.ts`, and `.tsx`
- Static imports, dynamic imports, CommonJS `require`, type-only imports, and re-exports
- `tsconfig.json` and `jsconfig.json` path alias resolution
- Circular dependency detection
- Orphan file detection with configurable entry points
- Unused export detection, including default exports, re-exports, barrel files, and type-only exports
- Unresolved local import detection
- Dependency impact analysis for direct and transitive dependents
- Project health scoring with A-F grade, issue counts, complexity hotspots, and dependency hubs
- Dependency-chain explanations for "why does file A depend on file B?"
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
- Built-in plugin aliases for complexity metadata, MCP metadata, and GitHub PR dependency-diff comments

## Install

```bash
npm install @depxray/core
```

## Basic Usage

```ts
import { analyzeImpact, computeHealthScore, findDependencyChain, scanProject } from '@depxray/core';

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

const impact = analyzeImpact(result.graph, 'src/App.tsx');
console.log(impact.affectedFiles);
console.log(impact.highImpactComplexFiles);

const health = computeHealthScore(result);
console.log(health.grade);
console.log(health.hotspots);

const chain = findDependencyChain(result.graph, 'src/App.tsx', 'src/utils/format.ts');
console.log(chain.chains);
```

## Health Scoring

`computeHealthScore(result)` returns a compact project scorecard for dashboards, reports, and AI-agent preflight checks.

```ts
import { computeHealthScore, scanProject } from '@depxray/core';

const result = await scanProject({ rootDir: '/path/to/project' });
const health = computeHealthScore(result);

console.log(health.score);
console.log(health.grade);
console.log(health.issues);
console.log(health.hotspots);
console.log(health.hubs);
console.log(health.breakdown);
```

Every score starts at 100. `breakdown` contains the observed value, rule, and points deducted for each signal:

- circular chains: 5 points each, capped at 25
- orphan files: 2 points each, capped at 20
- unused internal exports: 0.5 points each, capped at 15
- unresolved local imports: 3 points each, capped at 15
- error-level architecture violations: 5 points each, capped at 25
- average cyclomatic complexity: 10 points when above 10, or 20 points when above 20

The final score is rounded and clamped between 0 and 100. Grades are A for 90-100, B for 80-89, C for 70-79, D for 60-69, and F for 0-59. The breakdown also includes the starting score, total deductions, average complexity, and grade thresholds so consumers can explain the result without duplicating scoring logic.

## Impact Analysis

`analyzeImpact(graph, filePath)` returns the direct and transitive dependents of a file, shortest dependency paths back to the target, per-file metrics, and high-impact/high-complexity risk signals.

```ts
import { analyzeImpact, scanProject } from '@depxray/core';

const result = await scanProject({ rootDir: '/path/to/project' });
const impact = analyzeImpact(result.graph, 'src/utils/format.ts', {
  complexityThreshold: 10,
  impactThreshold: 10,
  inboundThreshold: 5,
});

console.log(impact.risk);
console.log(impact.directDependents);
console.log(impact.affectedFiles);
```

## Dependency Chains

`findDependencyChain(graph, from, to)` explains the shortest import paths from one file to another.

```ts
import { findDependencyChain, scanProject } from '@depxray/core';

const result = await scanProject({ rootDir: '/path/to/project' });
const chain = findDependencyChain(result.graph, 'src/App.tsx', 'src/utils/format.ts');

console.log(chain.connected);
console.log(chain.shortestDistance);
console.log(chain.chains);
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

Built-in plugin aliases:

- `@depxray/plugin-complexity`: scan-level complexity metadata
- `@depxray/plugin-mcp`: MCP-oriented tool and scan summary metadata
- `@depxray/plugin-github-pr`: Markdown dependency-diff comments for GitHub PR review

## Related Packages

- `depxray`: CLI, browser UI, reports, exports, graph diffing, and config-driven workflows
- `@depxray/mcp`: MCP server for AI coding agents

## Privacy

`@depxray/core` runs locally and performs static analysis on files you point it at. It does not send source code to depxray or any external depxray service.
