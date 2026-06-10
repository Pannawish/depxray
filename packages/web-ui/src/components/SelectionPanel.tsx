import type { FileRelationshipIndex, FolderSummary } from '../relationshipIndex.js';
import type { ExplorerGraphNode } from '../types.js';

interface SelectionPanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  folderSummary: FolderSummary | null;
  projectRoot: string;
  error: string | null;
  onDragStart: () => void;
  onDrop: () => void;
  onSwapVertical: () => void;
  onSwapHorizontal: () => void;
}

function formatBytes(value: number | undefined): string {
  if (!value) {
    return 'n/a';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatInstability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function SelectionPanel({
  node,
  index,
  folderSummary,
  projectRoot,
  error,
  onDragStart,
  onDrop,
  onSwapVertical,
  onSwapHorizontal,
}: SelectionPanelProps) {
  if (!node) {
    return (
      <section className="details-panel">
        <div 
          className="panel-header draggable" 
          draggable
          onDragStart={onDragStart}
          onDragOver={(e) => e.preventDefault()} 
          onDrop={onDrop}
          style={{ cursor: 'grab' }}
        >
          <div className="drag-handle-layout">
            <div className="drag-handle">⋮⋮</div>
            <div>
              <p className="eyebrow">Selection</p>
              <h2>No file selected</h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="swap-layout-btn"
              onClick={onSwapVertical}
              title="Swap vertical layout with Code Viewer"
              type="button"
            >
              ⇅
            </button>
            <button 
              className="swap-layout-btn"
              onClick={onSwapHorizontal}
              title="Swap horizontal column with Project Tree"
              type="button"
            >
              ⇄
            </button>
          </div>
        </div>
        {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
      </section>
    );
  }

  const imports = index.importsBySourceId.get(node.id) ?? [];
  const importedBy = index.importedByTargetId.get(node.id) ?? [];
  const isDirectory = node.kind === 'directory';
  const hasCircular = isDirectory
    ? Boolean(folderSummary && folderSummary.circularFiles.length > 0)
    : node.isCircular;
  const hasOrphans = isDirectory
    ? Boolean(folderSummary && folderSummary.orphanFiles.length > 0)
    : node.isOrphan;

  return (
    <section className="details-panel">
      <div 
        className="panel-header draggable" 
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => e.preventDefault()} 
        onDrop={onDrop}
        style={{ cursor: 'grab' }}
      >
        <div className="drag-handle-layout">
          <div className="drag-handle">⋮⋮</div>
          <div>
            <p className="eyebrow">{isDirectory ? 'Folder' : 'File'}</p>
            <h2>{node.label}</h2>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isDirectory && (
            <span className="code-viewer-stats">
              {imports.length} imports • {importedBy.length} dependents
            </span>
          )}
          {hasCircular && (
            <span 
              style={{
                fontSize: '0.72rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '99px',
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid rgba(179, 58, 50, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ⚠️ Circular
            </span>
          )}
          {hasOrphans && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '99px',
                background: 'var(--warning-soft)',
                color: 'var(--warning)',
                border: '1px solid rgba(154, 91, 20, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Orphan
            </span>
          )}
          <button 
            className="swap-layout-btn"
            onClick={onSwapVertical}
            title="Swap vertical layout with Code Viewer"
            type="button"
          >
            ⇅
          </button>
          <button 
            className="swap-layout-btn"
            onClick={onSwapHorizontal}
            title="Swap horizontal column with Project Tree"
            type="button"
          >
            ⇄
          </button>
        </div>
      </div>

      <div className="badge-row">
        <span>{node.kind}</span>
        <span>depth {node.depth}</span>
        {node.extension ? <span>{node.extension}</span> : null}
        {node.isCircular ? <span className="danger">circular</span> : null}
        {node.isOrphan ? <span className="warning">orphan</span> : null}
      </div>

      <dl className="detail-list">
        <DetailRow label="Relative path" value={node.relativePath} />
        <DetailRow label="Absolute path" value={node.absolutePath} />
        <DetailRow label="Project root" value={projectRoot} />
        <DetailRow label="Size" value={formatBytes(node.sizeBytes)} />
        {isDirectory && folderSummary ? (
          <>
            <DetailRow label="Direct children" value={folderSummary.directChildren} />
            <DetailRow label="Descendants" value={folderSummary.descendants} />
            <DetailRow label="Files under folder" value={folderSummary.totalFiles} />
            <DetailRow label="Internal imports" value={folderSummary.internalImports.length} />
            <DetailRow label="Incoming external refs" value={folderSummary.incomingExternal.length} />
            <DetailRow label="Outgoing external refs" value={folderSummary.outgoingExternal.length} />
            <DetailRow label="Circular files" value={folderSummary.circularFiles.length} />
            <DetailRow label="Orphan files" value={folderSummary.orphanFiles.length} />
          </>
        ) : (
          <>
            <DetailRow label="Outgoing imports" value={imports.length} />
            <DetailRow label="Incoming imports" value={importedBy.length} />
            <DetailRow label="Circular" value={node.isCircular ? 'yes' : 'no'} />
            <DetailRow label="Orphan" value={node.isOrphan ? 'yes' : 'no'} />
            {node.workspace ? <DetailRow label="Workspace" value={node.workspace} /> : null}
            {node.metrics ? (
              <>
                <DetailRow label="Lines of code" value={node.metrics.loc} />
                <DetailRow label="Complexity" value={node.metrics.cyclomaticComplexity} />
                <DetailRow label="Exports" value={node.metrics.exportCount} />
                <DetailRow label="Instability" value={formatInstability(node.metrics.instability)} />
              </>
            ) : null}
            {node.componentName ? <DetailRow label="Component" value={node.componentName} /> : null}
          </>
        )}
      </dl>

      {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
    </section>
  );
}
