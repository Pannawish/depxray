# Changelog

## Unreleased

## 1.3.1 - 2026-06-10

### Added

- Added configuration file support for `depxray scan`.
- Added `depxray init` to scaffold `depxray.config.js` with sensible defaults.
- Added support for `depxray.config.js`, `depxray.config.mjs`, `.depxrayrc.json`, and the `depxray` key in `package.json`.

### Changed

- `depxray scan` now merges persistent config with CLI flags, with CLI flags taking precedence.

## 1.3.0 - 2026-06-10

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

## 1.2.0 - 2026-06-09

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

## 1.1.0 - 2026-06-09

### Added

- Added orphan file detection for dependency scans.
- Added `orphanFiles` to dependency-mode JSON output and per-node `isOrphan` metadata.
- Added `depxray scan --orphans` to print orphan files to `stderr`.
- Added `depxray scan --entry-points <patterns...>` to customize orphan detection exclusions.
- Added browser UI orphan badges, orphan-only filtering, and orphan counts in file/folder details.

### Changed

- Updated package versions to `1.1.0`.
