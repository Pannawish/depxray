# Changelog

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
