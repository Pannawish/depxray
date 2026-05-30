import type { DependencyFilters, GraphMode } from '../types.js';

interface ExplorerToolbarProps {
  availableModes: GraphMode[];
  activeMode: GraphMode;
  sourceLabel: string;
  searchTerm: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  visibleRows: number;
  dependencyFilters: DependencyFilters;
  onModeChange: (mode: GraphMode) => void;
  onSearchChange: (searchTerm: string) => void;
  onDependencyFiltersChange: (filters: DependencyFilters) => void;
}

export function ExplorerToolbar({
  availableModes,
  activeMode,
  sourceLabel,
  searchTerm,
  totalFiles,
  totalDirs,
  totalImports,
  circularCount,
  visibleRows,
  dependencyFilters,
  onModeChange,
  onSearchChange,
  onDependencyFiltersChange,
}: ExplorerToolbarProps) {
  return (
    <header className="explorer-toolbar">
      <div className="toolbar-title">
        <p className="eyebrow">React Dependency Graph</p>
        <h1>Codebase Explorer</h1>
      </div>

      <div className="toolbar-search">
        <label htmlFor="project-search">Search paths</label>
        <input
          id="project-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="src/App.tsx"
          type="search"
          value={searchTerm}
        />
      </div>

      <div className="toolbar-modes" aria-label="Graph mode">
        {availableModes.map((mode) => (
          <button
            className={activeMode === mode ? 'active' : ''}
            key={mode}
            onClick={() => onModeChange(mode)}
            type="button"
          >
            {mode === 'structure' ? 'Structure' : 'Dependencies'}
          </button>
        ))}
      </div>

      <div className="toolbar-filters">
        <label>
          <input
            checked={dependencyFilters.showTypeOnlyEdges}
            onChange={(event) => onDependencyFiltersChange({
              ...dependencyFilters,
              showTypeOnlyEdges: event.target.checked,
            })}
            type="checkbox"
          />
          Type-only
        </label>
        <label>
          <input
            checked={dependencyFilters.showDynamicEdges}
            onChange={(event) => onDependencyFiltersChange({
              ...dependencyFilters,
              showDynamicEdges: event.target.checked,
            })}
            type="checkbox"
          />
          Dynamic
        </label>
        <label>
          <input
            checked={dependencyFilters.circularOnly}
            onChange={(event) => onDependencyFiltersChange({
              ...dependencyFilters,
              circularOnly: event.target.checked,
            })}
            type="checkbox"
          />
          Cycles only
        </label>
      </div>

      <div className="toolbar-stats" aria-label="Project summary">
        <span>{totalDirs} dirs</span>
        <span>{totalFiles} files</span>
        <span>{totalImports} imports</span>
        <span>{circularCount} circular</span>
        <span>{visibleRows} visible</span>
        <span>{sourceLabel}</span>
      </div>
    </header>
  );
}
