import type { NodeProps } from 'reactflow';
import type { ExplorerGraphNode, GraphMode } from '../types.js';

interface CircleNodeData {
  node: ExplorerGraphNode;
  mode: GraphMode;
  selected: boolean;
  matched: boolean;
  emphasized: boolean;
  dimmed: boolean;
  onToggle: (nodeId: string) => void;
}

export function CircleNode({ data }: NodeProps<CircleNodeData>) {
  const { node, mode, selected, matched, emphasized, dimmed, onToggle } = data;
  const isDirectory = node.kind === 'directory';
  const size = mode === 'dependencies'
    ? Math.min(112, 64 + ((node.inDegree ?? 0) + (node.outDegree ?? 0)) * 4)
    : isDirectory
    ? Math.min(110, 76 + node.descendantCount * 2)
    : 58;

  return (
    <div
      className={[
        'circle-node',
        isDirectory ? 'directory' : 'file',
        node.isCircular ? 'circular' : '',
        selected ? 'selected' : '',
        matched ? 'matched' : '',
        emphasized ? 'emphasized' : '',
        dimmed ? 'dimmed' : '',
      ].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      title={node.relativePath}
    >
      <span className="circle-node-icon">
        {mode === 'dependencies'
          ? (node.extension?.replace('.', '').slice(0, 3) ?? 'dep')
          : isDirectory
            ? 'D'
            : node.extension?.replace('.', '').slice(0, 3) ?? 'F'}
      </span>
      <span className="circle-node-label">{node.label}</span>
      {mode === 'structure' && isDirectory && node.childCount > 0 ? (
        <button
          className="circle-node-toggle"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
          type="button"
        >
          {node.collapsed ? `+${node.childCount}` : '−'}
        </button>
      ) : null}
    </div>
  );
}
