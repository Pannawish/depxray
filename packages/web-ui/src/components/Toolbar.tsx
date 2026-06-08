import { SearchBox } from './SearchBox.js';
import type { DependencyFilters, DepthFilter, GraphMode } from '../types.js';

interface ToolbarProps {
  availableModes: GraphMode[];
  activeMode: GraphMode;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  visibleNodes: number;
  matchCount: number;
  collapsedCount: number;
  sourceLabel: string;
  depthFilter: DepthFilter;
  searchTerm: string;
  dependencyFilters: DependencyFilters;
  onModeChange: (nextMode: GraphMode) => void;
  onDependencyFiltersChange: (nextFilters: DependencyFilters) => void;
  onDepthChange: (nextDepth: DepthFilter) => void;
  onSearchChange: (nextSearch: string) => void;
  onClearSearch: () => void;
  onFitView: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResetCollapsed: () => void;
}

export function Toolbar({
  availableModes,
  activeMode,
  totalFiles,
  totalDirs,
  totalImports,
  circularCount,
  visibleNodes,
  matchCount,
  collapsedCount,
  sourceLabel,
  depthFilter,
  searchTerm,
  dependencyFilters,
  onModeChange,
  onDependencyFiltersChange,
  onDepthChange,
  onSearchChange,
  onClearSearch,
  onFitView,
  onExpandAll,
  onCollapseAll,
  onResetCollapsed,
}: ToolbarProps) {
  const dependencyMode = activeMode === 'dependencies';

  return (
    <header className="toolbar-shell">
      <div>
        <p className="eyebrow">
          {dependencyMode ? 'Dependency graph mode' : 'Local structure graph'}
        </p>
        <h1>Depxray</h1>
        <p className="toolbar-hint">Press <kbd>F</kbd> to fit the view and <kbd>Esc</kbd> to deselect.</p>
      </div>

      <div className="toolbar-stats">
        <span>{totalDirs} dirs</span>
        <span>{totalFiles} files</span>
        {dependencyMode ? <span>{totalImports} imports</span> : null}
        {dependencyMode ? <span>{circularCount} circular</span> : null}
        <span>{visibleNodes} visible</span>
        <span>{collapsedCount} collapsed</span>
        {searchTerm ? <span>{matchCount} matches</span> : null}
        <span>{sourceLabel}</span>
      </div>

      <div className="toolbar-controls">
        <div className="toolbar-mode-group" role="tablist" aria-label="Graph mode">
          {availableModes.map((availableMode) => (
            <button
              key={availableMode}
              className={[
                'toolbar-chip-button',
                activeMode === availableMode ? 'active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onModeChange(availableMode)}
              type="button"
            >
              {availableMode === 'structure' ? 'Structure' : 'Dependencies'}
            </button>
          ))}
        </div>

        <label className="toolbar-select">
          <span>Depth</span>
          <select
            value={String(depthFilter)}
            onChange={(event) => {
              const value = event.target.value;
              onDepthChange(
                value === 'all' ? 'all' : Number(value) as DepthFilter,
              );
            }}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="all">All</option>
          </select>
        </label>

        <SearchBox
          value={searchTerm}
          onChange={onSearchChange}
          onClear={onClearSearch}
        />

        {dependencyMode ? (
          <div className="toolbar-filter-group">
            <label className="toolbar-check">
              <input
                checked={dependencyFilters.showTypeOnlyEdges}
                onChange={(event) => {
                  onDependencyFiltersChange({
                    ...dependencyFilters,
                    showTypeOnlyEdges: event.target.checked,
                  });
                }}
                type="checkbox"
              />
              <span>Type-only</span>
            </label>
            <label className="toolbar-check">
              <input
                checked={dependencyFilters.showDynamicEdges}
                onChange={(event) => {
                  onDependencyFiltersChange({
                    ...dependencyFilters,
                    showDynamicEdges: event.target.checked,
                  });
                }}
                type="checkbox"
              />
              <span>Dynamic</span>
            </label>
            <label className="toolbar-check">
              <input
                checked={dependencyFilters.circularOnly}
                onChange={(event) => {
                  onDependencyFiltersChange({
                    ...dependencyFilters,
                    circularOnly: event.target.checked,
                  });
                }}
                type="checkbox"
              />
              <span>Cycles only</span>
            </label>
            <label className="toolbar-check">
              <input
                checked={dependencyFilters.orphanOnly}
                onChange={(event) => {
                  onDependencyFiltersChange({
                    ...dependencyFilters,
                    orphanOnly: event.target.checked,
                  });
                }}
                type="checkbox"
              />
              <span>Orphans only</span>
            </label>
          </div>
        ) : null}

        <div className="toolbar-action-group">
          <button className="toolbar-button" onClick={onFitView} type="button">
            Fit view
          </button>
          <button
            className="toolbar-button"
            disabled={dependencyMode}
            onClick={onExpandAll}
            type="button"
          >
            Expand all
          </button>
          <button
            className="toolbar-button"
            disabled={dependencyMode}
            onClick={onCollapseAll}
            type="button"
          >
            Collapse all
          </button>
          <button
            className="toolbar-button subtle"
            disabled={dependencyMode}
            onClick={onResetCollapsed}
            type="button"
          >
            Auto collapse
          </button>
        </div>
      </div>

      {dependencyMode ? (
        <div className="toolbar-legend">
          <span><i className="legend-swatch standard" /> Standard import</span>
          <span><i className="legend-swatch type-only" /> Type-only import</span>
          <span><i className="legend-swatch dynamic" /> Dynamic import</span>
          <span><i className="legend-swatch circular" /> Circular participant</span>
        </div>
      ) : null}
    </header>
  );
}
