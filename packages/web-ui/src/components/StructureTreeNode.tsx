import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ExplorerGraphNode } from '../types.js';

export interface StructureTreeNodeData {
  node: ExplorerGraphNode;
  onFocus: (nodeId: string) => void;
}

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 7.53 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const FocusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
  </svg>
);

export function StructureTreeNode({ data, selected }: NodeProps<StructureTreeNodeData>) {
  const { node, onFocus } = data;

  return (
    <div className={`structure-tree-node ${selected ? 'selected' : ''} ${node.kind}`}>
      {/* Invisible handle for incoming edge from parent */}
      <Handle type="target" position={Position.Top} className="tree-handle" isConnectable={false} />
      
      <div className="st-node-content">
        <div className="st-node-header">
          <span className="st-node-icon">
            {node.kind === 'directory' ? <FolderIcon /> : <FileIcon />}
          </span>
          <span className="st-node-label" title={node.relativePath}>
            {node.label}
          </span>
        </div>
        {node.kind === 'directory' && (
          <div className="st-node-meta">
            {node.childCount} items
          </div>
        )}
      </div>

      <button 
        className="st-node-focus-btn" 
        onClick={(e) => {
          e.stopPropagation();
          onFocus(node.id);
        }}
        title={`Focus on ${node.label}`}
      >
        <FocusIcon />
      </button>
      
      {/* Invisible handle for outgoing edges to children */}
      <Handle type="source" position={Position.Bottom} className="tree-handle" isConnectable={false} />
    </div>
  );
}
