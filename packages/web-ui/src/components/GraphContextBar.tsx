import type { GraphBreadcrumb, DependencyPathResult } from '../graphScope.js';
import type { FileNeighborhoodDepth, FolderBoundaryMode, GraphScopeMode } from '../types.js';

interface GraphContextBarProps {
  scopeMode: GraphScopeMode;
  canUseFolderScope: boolean;
  canUseFileScope: boolean;
  neighborhoodDepth: FileNeighborhoodDepth;
  folderBoundaryMode: FolderBoundaryMode;
  breadcrumbs: GraphBreadcrumb[];
  pathResult: DependencyPathResult | null;
  pathLabel: string | null;
  onScopeModeChange: (mode: GraphScopeMode) => void;
  onNeighborhoodDepthChange: (depth: FileNeighborhoodDepth) => void;
  onFolderBoundaryModeChange: (mode: FolderBoundaryMode) => void;
  onBreadcrumbSelect: (nodeId: string) => void;
  onClearPath: () => void;
}

export function GraphContextBar({
  scopeMode,
  canUseFolderScope,
  canUseFileScope,
  neighborhoodDepth,
  folderBoundaryMode,
  breadcrumbs,
  pathResult,
  pathLabel,
  onScopeModeChange,
  onNeighborhoodDepthChange,
  onFolderBoundaryModeChange,
  onBreadcrumbSelect,
  onClearPath,
}: GraphContextBarProps) {
  return (
    <div className="graph-context-bar">
      <div className="graph-scope-toggle" aria-label="Graph scope">
        <button
          className={scopeMode === 'project' ? 'active' : ''}
          onClick={() => onScopeModeChange('project')}
          type="button"
        >
          Project
        </button>
        <button
          className={scopeMode === 'folder' ? 'active' : ''}
          disabled={!canUseFolderScope}
          onClick={() => onScopeModeChange('folder')}
          type="button"
        >
          Folder
        </button>
        <button
          className={scopeMode === 'file' ? 'active' : ''}
          disabled={!canUseFileScope}
          onClick={() => onScopeModeChange('file')}
          type="button"
        >
          File neighborhood
        </button>
      </div>

      {scopeMode === 'file' ? (
        <label className="graph-label-select" title="Dependency neighborhood depth">
          <span>Depth</span>
          <select
            value={neighborhoodDepth}
            onChange={(event) => {
              const value = event.target.value;
              onNeighborhoodDepthChange(value === 'all' ? 'all' : (Number(value) as 1 | 2));
            }}
          >
            <option value="1">Direct</option>
            <option value="2">2 levels</option>
            <option value="all">All</option>
          </select>
        </label>
      ) : null}

      {scopeMode === 'folder' ? (
        <label className="graph-label-select" title="Folder boundary relationship type">
          <span>Edges</span>
          <select
            value={folderBoundaryMode}
            onChange={(event) => {
              onFolderBoundaryModeChange(event.target.value as FolderBoundaryMode);
            }}
          >
            <option value="all">All</option>
            <option value="internal">Internal</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
        </label>
      ) : null}

      <nav className="graph-breadcrumbs" aria-label="Graph location">
        {breadcrumbs.map((breadcrumb, index) => (
          <span key={breadcrumb.id}>
            {index > 0 ? <span className="graph-breadcrumb-separator">/</span> : null}
            <button
              onClick={() => onBreadcrumbSelect(breadcrumb.id)}
              title={
                breadcrumb.kind === 'directory' ? 'Open folder scope' : 'Open file neighborhood'
              }
              type="button"
            >
              {breadcrumb.label}
            </button>
          </span>
        ))}
      </nav>

      {pathResult && pathLabel ? (
        <div
          className={
            pathResult.connected ? 'graph-path-notice connected' : 'graph-path-notice disconnected'
          }
        >
          <span>{pathLabel}</span>
          <button onClick={onClearPath} title="Clear dependency path" type="button">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
