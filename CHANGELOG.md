# Changelog

## Unreleased

### Removed

- Removed the unmaintained VS Code extension scaffold; depxray continues to provide editor-independent CLI, browser UI, and MCP integrations.

## 3.1.0 - 11/06/2026

### Added

- Added core `computeHealthScore` for A-F project health scoring with issue counts, complexity hotspots, and dependency hubs.
- Added core `findDependencyChain` for shortest dependency-chain explanations between files.
- Added MCP `check_health`, `find_unused_exports`, `explain_dependency_chain`, `find_related_files`, `suggest_cleanup`, and `diff_graphs` tools for AI-agent preflight analysis, cleanup planning, and PR review workflows.
- Added browser Health Dashboard with project score, issue summary, complexity hotspots, and dependency hubs.
- Added browser graph heatmap color modes for extension, complexity, file size, and instability.
- Added built-in `@depxray/plugin-github-pr` to format dependency graph diffs as Markdown for GitHub PR comments.

### Changed

- Extended CLI and MCP graph data with `healthScore` for browser and agent workflows.
- Updated README files and package descriptions for v3.1.0 health, cleanup, dependency-chain, heatmap, MCP, and GitHub PR plugin workflows.
- Updated version sync tooling to derive synced packages from the root workspace list and update internal workspace dependency versions generically.

### Fixed

- `findDependencyChain` now returns a valid zero-length chain when the source and target are the same scanned file.

## 3.0.0 - 11/06/2026

### Added

- Added unused export detection for dependency scans, including named exports, default exports, re-exports, barrel files, and type-only exports.
- Added `depxray scan --fix`, `--dry-run`, and `--yes` for safe autofixes.
- Added autofix planning and application for unused export line removal, orphan file deletion, configured import convention rewrites, and unused npm dependency removal with `--fix --deps`.
- Added unresolved local import detection while ignoring external packages and common asset imports.
- Added devDependencies-in-production detection with `prodEntryPoints`, `devEntryPoints`, and `ignoreTypeImports` config support.
- Added `depxray entry-points`, `depxray trace`, and `depxray tree` for entry-point discovery, reverse reachability, and transitive import tree analysis.
- Added import convention detection through `importConventions` config.
- Added package.json `exports` and `imports` map resolution for workspace package imports.
- Added `depxray check` for CI/CD health checks with exit code 1 on circular dependencies, orphan files, unused exports, unresolved imports, architecture errors, devDependency production usage, or import convention violations.
- Added SARIF output through `depxray scan --mode dependencies --json --format sarif`.
- Added entry-point-scoped restricted import rules using `rules[].entryPoints` with `deny.files` and `deny.modules`.
- Added a VS Code extension scaffold with import/dependent-count CodeLens, diagnostics for unused exports, unresolved imports, and circular files, an "Open Current File" command, and a dependency tree view.
- Added MCP `scan_project` inputs for production entry points, development entry points, type-only import handling, and import convention checks.
- Added dependency impact analysis through core `analyzeImpact`, `depxray impact <file>`, browser graph blast-radius highlighting, and MCP `analyze_impact`.

### Changed

- Extended scan, report, browser, CLI JSON, and MCP outputs with unused export, unresolved import, devDependency production, import convention, and impact findings.
- Updated `depxray init` defaults with v3 configuration examples.
- Updated README files and package descriptions for v3.0.0 workflows, CI checks, SARIF, autofix, entry-point analysis, modern package resolution, impact analysis, MCP, and AI-agent usage.

## 2.1.0 - 11/06/2026

### Added

- Added unused export detection for dependency scans, including named exports, default exports, re-exports, barrel files, and type-only exports.
- Added unresolved local import detection for dependency scans, while ignoring external packages and common asset imports.
- Added `depxray scan --unused-exports` to print unused export findings to `stderr`.
- Added `depxray scan --unresolved` to print unresolved local imports to `stderr`.
- Added `unusedExports` per file in dependency JSON, inspect output, MCP scan output, and MCP inspect output.
- Added top-level `unresolvedImports` to dependency JSON, report output, and MCP scan output.
- Added browser UI unused-export badges, an unused-export toolbar filter, file detail sections for unused exports and unresolved imports, and graph coloring for both issue types.
- Added project health report sections for unused exports and unresolved imports.

### Changed

- Updated the GitHub and npm README files to document unused export detection, unresolved import detection, and the new CLI workflows for developers and AI agents.

## 2.0.0 - 11/06/2026

### Added

- Added lightweight architecture rule validation with `depxray scan --validate`, config-driven `rules`, stderr violation reporting, and exit code 1 for error-level violations.
- Added browser graph highlighting for dependency edges that violate architecture rules.
- Added graph diffing with `depxray diff <before.json> <after.json>` and `depxray diff --base <ref>`.
- Added machine-readable `depxray diff --json` output for added and removed files, edges, and circular dependencies.
- Added a config-driven plugin system with `afterBuildGraph`, `afterScan`, and `onReport` hooks.
- Added built-in plugin aliases for `@depxray/plugin-complexity` and `@depxray/plugin-mcp`.

### Changed

- Updated package descriptions and README content to reflect the current dependency intelligence, AI-agent, MCP, graph diffing, architecture rule, and plugin workflows.

## 1.5.0 - 10/06/2026

### Added

- Added monorepo workspace awareness for dependency scans, including per-node workspace labels and cross-package edge metadata.
- Added browser graph workspace coloring and dashed cross-package dependency edges.
- Added Mermaid and Graphviz DOT dependency graph exports through `depxray scan --mode dependencies --json --format mermaid|dot`.

## 1.4.0 - 10/06/2026

### Added

- Added `depxray scan --watch` to update the browser UI when project files change.
- Added a live WebSocket update channel for browser graph refreshes.
- Added per-file metrics for lines of code, cyclomatic complexity, export count, and instability.
- Added file metrics to dependency JSON, MCP scan/inspect output, and browser file details.
- Added `depxray report` to generate Markdown project health reports with summary counts, hub files, heavy importers, orphans, circular chains, and complexity hotspots.
- Added `depxray scan --deps --json` to report unused and unlisted npm dependencies.

## 1.3.1 - 10/06/2026

### Added

- Added configuration file support for `depxray scan`.
- Added `depxray init` to scaffold `depxray.config.js` with sensible defaults.
- Added support for `depxray.config.js`, `depxray.config.mjs`, `.depxrayrc.json`, and the `depxray` key in `package.json`.

### Changed

- `depxray scan` now merges persistent config with CLI flags, with CLI flags taking precedence.

## 1.3.0 - 10/06/2026

### Added

- Added the new `@depxray/mcp` package for MCP-compatible AI coding agents.
- Added MCP stdio server support with tools for project scanning, file inspection, circular dependency detection, orphan detection, file-tree retrieval, and folder summaries.
- Added `@depxray/core` as a published scoped package for shared runtime analysis.
- Added MCP setup documentation for Claude Desktop, Cursor, and other MCP clients.
- Added MCP handler tests and server registration coverage for all public tools.

### Changed

- Updated root build and version sync scripts to include the MCP workspace.
- Updated README files with MCP usage, AI-agent workflows, and the safer `npx --package @depxray/mcp depxray-mcp` launch command.
- Normalized npm package metadata for publish compatibility.

### Fixed

- Fixed MCP runtime package metadata loading so the built server starts correctly on modern Node.js versions.

## 1.2.0 - 09/06/2026

### Added

- Added an interactive force-directed graph view to the browser UI.
- Added a toolbar toggle between Graph and Miller views.
- Added graph support for both dependency-mode edges and structure-mode parent-child edges.
- Added graph zooming, panning, node dragging, click-to-select behavior, and selected-node centering.
- Added graph node labels with Smart, All, and None visibility modes.
- Added graph node coloring by extension, circular status, and orphan status.
- Added directional dependency arrows and circular relationship highlighting.

### Changed

- The browser UI now opens with the Graph view as the default center panel.
- Updated package versions to `1.2.0`.

## 1.1.0 - 09/06/2026

### Added

- Added orphan file detection for dependency scans.
- Added `orphanFiles` to dependency-mode JSON output and per-node `isOrphan` metadata.
- Added `depxray scan --orphans` to print orphan files to `stderr`.
- Added `depxray scan --entry-points <patterns...>` to customize orphan detection exclusions.
- Added browser UI orphan badges, orphan-only filtering, and orphan counts in file/folder details.

### Changed

- Updated package versions to `1.1.0`.
