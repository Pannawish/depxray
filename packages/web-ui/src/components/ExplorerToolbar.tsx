import React from 'react';

type CenterViewMode = 'miller' | 'graph' | 'dashboard';

interface ExplorerToolbarProps {
  sourceLabel: string;
  searchTerm: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  orphanCount: number;
  unusedExportCount: number;
  visibleRows: number;
  circularOnly: boolean;
  orphanOnly: boolean;
  unusedExportsOnly: boolean;
  centerViewMode: CenterViewMode;
  onSearchChange: (searchTerm: string) => void;
  onCircularOnlyChange: (circularOnly: boolean) => void;
  onOrphanOnlyChange: (orphanOnly: boolean) => void;
  onUnusedExportsOnlyChange: (unusedExportsOnly: boolean) => void;
  onCenterViewModeChange: (viewMode: CenterViewMode) => void;
}

export function ExplorerToolbar({
  sourceLabel,
  searchTerm,
  totalFiles,
  totalDirs,
  totalImports,
  circularCount,
  orphanCount,
  unusedExportCount,
  visibleRows,
  circularOnly,
  orphanOnly,
  unusedExportsOnly,
  centerViewMode,
  onSearchChange,
  onCircularOnlyChange,
  onOrphanOnlyChange,
  onUnusedExportsOnlyChange,
  onCenterViewModeChange,
}: ExplorerToolbarProps) {
  return (
    <header className="explorer-toolbar">
      {/* Title block */}
      <div className="toolbar-title">
        <p className="eyebrow">Depxray</p>
        <h1>Codebase Explorer</h1>
      </div>

      {/* Spacious Search Container */}
      <div className="toolbar-search-container">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="project-search"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search files by name or path... (e.g. App.tsx)"
            type="search"
            value={searchTerm}
          />
          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              title="Clear search"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Action Controls & Stats */}
      <div className="toolbar-actions">
        <div className="center-view-toggle" aria-label="Center view mode">
          <button
            className={centerViewMode === 'miller' ? 'active' : ''}
            onClick={() => onCenterViewModeChange('miller')}
            title="Show dependency drill-down columns"
            type="button"
          >
            Miller
          </button>
          <button
            className={centerViewMode === 'graph' ? 'active' : ''}
            onClick={() => onCenterViewModeChange('graph')}
            title="Show force-directed graph"
            type="button"
          >
            Graph
          </button>
          <button
            className={centerViewMode === 'dashboard' ? 'active' : ''}
            onClick={() => onCenterViewModeChange('dashboard')}
            title="Show codebase health dashboard"
            type="button"
          >
            Dashboard
          </button>
        </div>

        {/* Cycles Pill Toggle */}
        <button
          className={`cycles-toggle-btn ${circularOnly ? 'active' : ''} ${circularCount > 0 ? 'has-cycles' : ''}`}
          onClick={() => onCircularOnlyChange(!circularOnly)}
          type="button"
          title="Filter project tree to show circular dependencies only"
        >
          <span className="cycles-dot"></span>
          Cycles Only
          {circularCount > 0 && <span className="cycles-count-badge">{circularCount}</span>}
        </button>

        <button
          className={`orphans-toggle-btn ${orphanOnly ? 'active' : ''} ${orphanCount > 0 ? 'has-orphans' : ''}`}
          onClick={() => onOrphanOnlyChange(!orphanOnly)}
          type="button"
          title="Filter project tree to show orphan files only"
        >
          <span className="orphans-dot"></span>
          Orphans Only
          {orphanCount > 0 && <span className="orphans-count-badge">{orphanCount}</span>}
        </button>

        <button
          className={`unused-toggle-btn ${unusedExportsOnly ? 'active' : ''} ${unusedExportCount > 0 ? 'has-unused' : ''}`}
          onClick={() => onUnusedExportsOnlyChange(!unusedExportsOnly)}
          type="button"
          title="Filter project tree to show files with unused exports"
        >
          <span className="unused-dot"></span>
          Unused Exports
          {unusedExportCount > 0 && <span className="unused-count-badge">{unusedExportCount}</span>}
        </button>

        {/* Low-profile Summary Stats */}
        <div className="toolbar-stats-summary" aria-label="Project stats">
          <div className="stat-pill" title="Total directories scanned">
            <span className="label">Dirs</span>
            <span className="val">{totalDirs}</span>
          </div>
          <div className="stat-pill" title="Total files scanned">
            <span className="label">Files</span>
            <span className="val">{totalFiles}</span>
          </div>
          <div className="stat-pill" title="Total import statements traced">
            <span className="label">Imports</span>
            <span className="val">{totalImports}</span>
          </div>
          <div
            className="stat-pill highlight"
            title="Currently visible nodes in the Project Explorer"
          >
            <span className="label">Visible</span>
            <span className="val">{visibleRows}</span>
          </div>
          <div className="stat-pill source-mode" title="Scan data source">
            <span className="val">{sourceLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
