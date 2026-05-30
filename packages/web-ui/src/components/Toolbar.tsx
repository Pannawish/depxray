import { SearchBox } from './SearchBox.js';
import type { DepthFilter, GraphMode } from '../types.js';

interface ToolbarProps {
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  visibleNodes: number;
  matchCount: number;
  collapsedCount: number;
  mode: GraphMode;
  sourceLabel: string;
  depthFilter: DepthFilter;
  searchTerm: string;
  onDepthChange: (nextDepth: DepthFilter) => void;
  onSearchChange: (nextSearch: string) => void;
  onClearSearch: () => void;
  onFitView: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResetCollapsed: () => void;
}

export function Toolbar({
  totalFiles,
  totalDirs,
  totalImports,
  circularCount,
  visibleNodes,
  matchCount,
  collapsedCount,
  mode,
  sourceLabel,
  depthFilter,
  searchTerm,
  onDepthChange,
  onSearchChange,
  onClearSearch,
  onFitView,
  onExpandAll,
  onCollapseAll,
  onResetCollapsed,
}: ToolbarProps) {
  return (
    <header className="toolbar-shell">
      <div>
        <p className="eyebrow">
          {mode === 'structure' ? 'Local structure graph' : 'Dependency graph mode'}
        </p>
        <h1>React Dependency Graph</h1>
        <p className="toolbar-hint">Press <kbd>F</kbd> to fit the view and <kbd>Esc</kbd> to deselect.</p>
      </div>

      <div className="toolbar-stats">
        <span>{totalDirs} dirs</span>
        <span>{totalFiles} files</span>
        {mode === 'dependencies' ? <span>{totalImports} imports</span> : null}
        {mode === 'dependencies' ? <span>{circularCount} circular</span> : null}
        <span>{visibleNodes} visible</span>
        <span>{collapsedCount} collapsed</span>
        {searchTerm ? <span>{matchCount} matches</span> : null}
        <span>{sourceLabel}</span>
      </div>

      <div className="toolbar-controls">
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

        <div className="toolbar-action-group">
          <button className="toolbar-button" onClick={onFitView} type="button">
            Fit view
          </button>
          <button className="toolbar-button" onClick={onExpandAll} type="button">
            Expand all
          </button>
          <button className="toolbar-button" onClick={onCollapseAll} type="button">
            Collapse all
          </button>
          <button className="toolbar-button subtle" onClick={onResetCollapsed} type="button">
            Auto collapse
          </button>
        </div>
      </div>
    </header>
  );
}
