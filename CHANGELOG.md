# Changelog

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
