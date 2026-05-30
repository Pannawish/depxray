import type { ExplorerGraphNode } from '../types.js';

export interface FileTreeRowData {
  node: ExplorerGraphNode;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  matched: boolean;
  circular: boolean;
}

interface FileTreeViewProps {
  rows: FileTreeRowData[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onToggleFolder: (nodeId: string) => void;
  onDragStart: () => void;
  onDrop: () => void;
  onSwap: () => void;
}

function getNodeIcon(node: ExplorerGraphNode, expanded: boolean): string {
  if (node.kind === 'directory') {
    return expanded ? 'v' : '>';
  }

  return node.extension?.replace('.', '').slice(0, 3) || 'file';
}

export function FileTreeView({
  rows,
  selectedNodeId,
  onSelectNode,
  onToggleFolder,
  onDragStart,
  onDrop,
  onSwap,
}: FileTreeViewProps) {
  if (!rows.length) {
    return (
      <section className="tree-panel">
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
              <p className="eyebrow">Project tree</p>
              <h2>No matching files</h2>
            </div>
          </div>
          <button 
            className="swap-layout-btn"
            onClick={onSwap}
            title="Swap columns horizontally"
            type="button"
          >
            ⇄
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tree-panel">
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
            <p className="eyebrow">Project tree</p>
            <h2>{rows.length.toLocaleString()} visible paths</h2>
          </div>
        </div>
        <button 
          className="swap-layout-btn"
          onClick={onSwap}
          title="Swap columns horizontally"
          type="button"
        >
          ⇄
        </button>
      </div>

      <div className="tree-rows" role="tree">
        {rows.map((row) => (
          <button
            className={[
              'tree-row',
              selectedNodeId === row.node.id ? 'selected' : '',
              row.matched ? 'matched' : '',
              row.circular ? 'circular' : '',
            ].filter(Boolean).join(' ')}
            key={row.node.id}
            onClick={() => onSelectNode(row.node.id)}
            role="treeitem"
            style={{ paddingLeft: `${12 + row.level * 16}px` }}
            type="button"
          >
            <span
              className="tree-toggle"
              onClick={(event) => {
                if (!row.hasChildren) {
                  return;
                }

                event.stopPropagation();
                onToggleFolder(row.node.id);
              }}
            >
              {getNodeIcon(row.node, row.expanded)}
            </span>
            <span className="tree-label">{row.node.label}</span>
            {row.node.kind === 'directory' ? (
              <span className="tree-meta">{row.node.childCount}</span>
            ) : (
              <span className="tree-meta">{row.node.extension ?? 'file'}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
