# Changelog

## 1.1.0 - 2026-06-09

### Added

- Added orphan file detection for dependency scans.
- Added `orphanFiles` to dependency-mode JSON output and per-node `isOrphan` metadata.
- Added `depxray scan --orphans` to print orphan files to `stderr`.
- Added `depxray scan --entry-points <patterns...>` to customize orphan detection exclusions.
- Added browser UI orphan badges, orphan-only filtering, and orphan counts in file/folder details.

### Changed

- Updated package versions to `1.1.0`.
