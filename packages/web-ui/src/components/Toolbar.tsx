import { SearchBox } from './SearchBox.js';
import type { DepthFilter } from '../types.js';

interface ToolbarProps {
  totalFiles: number;
  totalDirs: number;
  sourceLabel: string;
  depthFilter: DepthFilter;
  searchTerm: string;
  onDepthChange: (nextDepth: DepthFilter) => void;
  onSearchChange: (nextSearch: string) => void;
}

export function Toolbar({
  totalFiles,
  totalDirs,
  sourceLabel,
  depthFilter,
  searchTerm,
  onDepthChange,
  onSearchChange,
}: ToolbarProps) {
  return (
    <header className="toolbar-shell">
      <div>
        <p className="eyebrow">Local structure graph</p>
        <h1>React Dependency Graph</h1>
      </div>

      <div className="toolbar-stats">
        <span>{totalDirs} dirs</span>
        <span>{totalFiles} files</span>
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

        <SearchBox value={searchTerm} onChange={onSearchChange} />
      </div>
    </header>
  );
}
