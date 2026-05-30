import type { FileRelationshipIndex, FolderSummary } from '../relationshipIndex.js';
import type { ExplorerGraphNode } from '../types.js';

interface SelectionPanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  folderSummary: FolderSummary | null;
  projectRoot: string;
  error: string | null;
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

export function SelectionPanel({
  node,
  index,
  folderSummary,
  projectRoot,
  error,
}: SelectionPanelProps) {
  if (!node) {
    return (
      <section className="details-panel">
        <div className="panel-header">
          <p className="eyebrow">Selection</p>
          <h2>No file selected</h2>
        </div>
        {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
      </section>
    );
  }

  const imports = index.importsBySourceId.get(node.id) ?? [];
  const importedBy = index.importedByTargetId.get(node.id) ?? [];
  const isDirectory = node.kind === 'directory';

  return (
    <section className="details-panel">
      <div className="panel-header">
        <p className="eyebrow">{isDirectory ? 'Folder' : 'File'}</p>
        <h2>{node.label}</h2>
      </div>

      <div className="badge-row">
        <span>{node.kind}</span>
        <span>depth {node.depth}</span>
        {node.extension ? <span>{node.extension}</span> : null}
        {node.isCircular ? <span className="danger">circular</span> : null}
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
          </>
        ) : (
          <>
            <DetailRow label="Outgoing imports" value={imports.length} />
            <DetailRow label="Incoming imports" value={importedBy.length} />
            <DetailRow label="Circular" value={node.isCircular ? 'yes' : 'no'} />
            {node.componentName ? <DetailRow label="Component" value={node.componentName} /> : null}
          </>
        )}
      </dl>

      {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
    </section>
  );
}
