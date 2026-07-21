# Maintainability Guide

Depxray keeps orchestration at package boundaries and moves implementation details into focused
modules. New behavior should follow the same dependency direction shown in the root README: core is
independent, while the CLI, web UI, and MCP packages consume its public exports.

## Important boundaries

- `packages/core/src/scanProject.ts` orchestrates scans. File parsing and resolution belong in
  `scanFileAnalysis.ts`; post-graph policy checks belong in `scanDiagnostics.ts`.
- `packages/core/src/types.ts` is the public compatibility barrel. Domain definitions live in
  `analysisTypes.ts`, `diagnosticTypes.ts`, and `structureTypes.ts`.
- `packages/cli/src/commands/scan.ts` coordinates the command. Browser serving, watch behavior,
  fixes, option parsing, graph construction, and output formatting live in their named modules.
- `packages/web-ui/src/App.tsx` composes the explorer. Navigation and resizing state live in hooks;
  graph drawing code lives beside `ForceGraphView` in focused model/rendering modules.
- The web UI imports `@depxray/core/graph-contract` through the compiled package export. Do not add
  aliases that reach into another workspace's `src` directory.

## Verification

Run the full local quality gate with:

```bash
npm run verify
```

Run the real-browser explorer smoke test after installing Playwright Chromium:

```bash
npx playwright install chromium
npm run test:e2e --workspace @depxray/web-ui
```

The repository can analyze itself using `depxray.config.js`:

```bash
npm run analyze:self
```

The generated report is written under `.depxray/`, which is intentionally ignored by Git.
