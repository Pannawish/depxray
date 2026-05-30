import React from 'react';

interface ExplorerToolbarProps {
  sourceLabel: string;
  searchTerm: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  visibleRows: number;
  circularOnly: boolean;
  onSearchChange: (searchTerm: string) => void;
  onCircularOnlyChange: (circularOnly: boolean) => void;
}

export function ExplorerToolbar({
  sourceLabel,
  searchTerm,
  totalFiles,
  totalDirs,
  totalImports,
  circularCount,
  visibleRows,
  circularOnly,
  onSearchChange,
  onCircularOnlyChange,
}: ExplorerToolbarProps) {
  return (
    <header className="explorer-toolbar">
      {/* Title block */}
      <div className="toolbar-title">
        <p className="eyebrow">React Dependency Graph</p>
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
          <div className="stat-pill highlight" title="Currently visible nodes in the Project Explorer">
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
