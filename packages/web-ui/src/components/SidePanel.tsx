import type { StructureGraphNode } from '../types.js';

interface SidePanelProps {
  node: StructureGraphNode | null;
  projectRoot: string;
  error: string | null;
}

export function SidePanel({ node, projectRoot, error }: SidePanelProps) {
  if (!node) {
    return (
      <aside className="side-panel">
        <p className="eyebrow">Node details</p>
        <h2>Select a file or folder</h2>
        <p className="muted">
          Click a node to inspect its path, size, and hierarchy details.
        </p>
        {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
      </aside>
    );
  }

  return (
    <aside className="side-panel">
      <p className="eyebrow">{node.kind === 'directory' ? 'Directory' : 'File'}</p>
      <h2>{node.label}</h2>
      <dl className="detail-list">
        <div>
          <dt>Relative path</dt>
          <dd>{node.relativePath}</dd>
        </div>
        <div>
          <dt>Absolute path</dt>
          <dd>{node.absolutePath}</dd>
        </div>
        <div>
          <dt>Project root</dt>
          <dd>{projectRoot}</dd>
        </div>
        <div>
          <dt>Depth</dt>
          <dd>{node.depth}</dd>
        </div>
        <div>
          <dt>Children</dt>
          <dd>{node.childCount}</dd>
        </div>
        <div>
          <dt>Descendants</dt>
          <dd>{node.descendantCount}</dd>
        </div>
        <div>
          <dt>Extension</dt>
          <dd>{node.extension ?? 'directory'}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{node.sizeBytes ? `${node.sizeBytes.toLocaleString()} bytes` : 'n/a'}</dd>
        </div>
      </dl>
      {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
    </aside>
  );
}
