import type { NodeProps } from 'reactflow';
import type { StructureGraphNode } from '../types.js';

interface CircleNodeData {
  node: StructureGraphNode;
  selected: boolean;
  matched: boolean;
  emphasized: boolean;
  dimmed: boolean;
  onToggle: (nodeId: string) => void;
}

export function CircleNode({ data }: NodeProps<CircleNodeData>) {
  const { node, selected, matched, emphasized, dimmed, onToggle } = data;
  const isDirectory = node.kind === 'directory';
  const size = isDirectory
    ? Math.min(110, 76 + node.descendantCount * 2)
    : 58;

  return (
    <div
      className={[
        'circle-node',
        isDirectory ? 'directory' : 'file',
        selected ? 'selected' : '',
        matched ? 'matched' : '',
        emphasized ? 'emphasized' : '',
        dimmed ? 'dimmed' : '',
      ].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      title={node.relativePath}
    >
      <span className="circle-node-icon">
        {isDirectory ? 'D' : node.extension?.replace('.', '').slice(0, 3) ?? 'F'}
      </span>
      <span className="circle-node-label">{node.label}</span>
      {isDirectory && node.childCount > 0 ? (
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
