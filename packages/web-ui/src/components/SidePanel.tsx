import type { ExplorerGraphNode, GraphMode } from '../types.js';

interface SidePanelProps {
  node: ExplorerGraphNode | null;
  mode: GraphMode;
  projectRoot: string;
  error: string | null;
}

function getLayerPath(relativePath: string): string[] {
  if (relativePath === '.') {
    return ['.'];
  }

  return relativePath.split('/').filter(Boolean);
}

export function SidePanel({ node, mode, projectRoot, error }: SidePanelProps) {
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

  const layerPath = getLayerPath(node.relativePath);

  return (
    <aside className="side-panel">
      <p className="eyebrow">{node.kind === 'directory' ? 'Directory' : 'File'}</p>
      <h2>{node.label}</h2>
      <div className="detail-badges">
        <span>{node.kind}</span>
        <span>depth {node.depth}</span>
        {node.kind === 'directory' ? (
          <span>{node.collapsed ? 'collapsed' : 'expanded'}</span>
        ) : null}
        {node.extension ? <span>{node.extension}</span> : null}
      </div>
      <div className="layer-path">
        {layerPath.map((segment, index) => (
          <span key={`${segment}-${index}`}>{segment}</span>
        ))}
      </div>
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
          <dt>{mode === 'dependencies' ? 'Outgoing imports' : 'Children'}</dt>
          <dd>{mode === 'dependencies' ? (node.outDegree ?? 0) : node.childCount}</dd>
        </div>
        <div>
          <dt>{mode === 'dependencies' ? 'Incoming imports' : 'Descendants'}</dt>
          <dd>{mode === 'dependencies' ? (node.inDegree ?? 0) : node.descendantCount}</dd>
        </div>
        <div>
          <dt>Extension</dt>
          <dd>{node.extension ?? 'directory'}</dd>
        </div>
        {mode === 'dependencies' ? (
          <div>
            <dt>Circular</dt>
            <dd>{node.isCircular ? 'yes' : 'no'}</dd>
          </div>
        ) : null}
        {mode === 'dependencies' && node.componentName ? (
          <div>
            <dt>Component</dt>
            <dd>{node.componentName}</dd>
          </div>
        ) : null}
        <div>
          <dt>Size</dt>
          <dd>{node.sizeBytes ? `${node.sizeBytes.toLocaleString()} bytes` : 'n/a'}</dd>
        </div>
      </dl>
      <p className="muted panel-footnote">
        {mode === 'structure'
          ? 'Directory nodes can be expanded or collapsed from the graph canvas.'
          : 'Dependency nodes are sized by import activity and highlighted when they participate in matches or cycles.'}
      </p>
      {error ? <p className="panel-warning">Using sample data: {error}</p> : null}
    </aside>
  );
}
