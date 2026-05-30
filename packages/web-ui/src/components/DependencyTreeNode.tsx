import React, { useState } from 'react';
import type { ExplorerGraphNode } from '../types.js';
import type { FileRelationshipIndex } from '../relationshipIndex.js';

interface DependencyTreeNodeProps {
  nodeId: string;
  index: FileRelationshipIndex;
  direction: 'incoming' | 'outgoing';
  visitedIds: Set<string>;
  onSelectNode: (nodeId: string) => void;
  depth: number;
}

// Inline SVGs for beautiful design
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
      color: 'var(--muted)'
    }}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const FileIcon = ({ extension }: { extension: string | null }) => {
  let color = '#a0aec0'; // default gray
  let extText = 'JS';
  
  if (extension) {
    const ext = extension.toLowerCase();
    if (ext === '.tsx') {
      color = '#007acc'; // TypeScript React Blue
      extText = 'TSX';
    } else if (ext === '.ts') {
      color = '#3178c6'; // TypeScript Blue
      extText = 'TS';
    } else if (ext === '.jsx') {
      color = '#f7df1e'; // JS Yellow
      extText = 'JSX';
    } else if (ext === '.js') {
      color = '#e3c800'; // JS Darker Yellow
      extText = 'JS';
    } else if (ext === '.css') {
      color = '#38bdf8'; // CSS Sky Blue
      extText = 'CSS';
    } else if (ext === '.json') {
      color = '#f43f5e'; // JSON Rose
      extText = '{}';
    }
  }

  return (
    <span className="tree-node-icon-wrapper" style={{ '--icon-color': color } as React.CSSProperties}>
      <span className="tree-node-ext-label">{extText}</span>
    </span>
  );
};

const FocusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
  </svg>
);

const WarningIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function DependencyTreeNode({
  nodeId,
  index,
  direction,
  visitedIds,
  onSelectNode,
  depth,
}: DependencyTreeNodeProps) {
  const node = index.nodeById.get(nodeId);
  const [expanded, setExpanded] = useState(false);

  if (!node) {
    return null;
  }

  // Find child/dependency nodes in the specified direction
  const edges =
    direction === 'outgoing'
      ? index.importsBySourceId.get(nodeId) ?? []
      : index.importedByTargetId.get(nodeId) ?? [];

  const childIds = edges
    .map((edge) => (direction === 'outgoing' ? edge.target : edge.source))
    .filter((id) => index.nodeById.has(id));

  // Sort child nodes by label for readability
  const children = childIds
    .map((id) => index.nodeById.get(id)!)
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasChildren = children.length > 0;
  const isCircularLoop = visitedIds.has(nodeId);
  const nextVisitedIds = new Set(visitedIds).add(nodeId);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren && !isCircularLoop) {
      setExpanded(!expanded);
    }
  };

  const handleNodeClick = () => {
    onSelectNode(node.id);
  };

  return (
    <div className={`dep-tree-node-container ${depth > 0 ? 'nested' : ''}`}>
      <div 
        className={`dep-tree-row-wrapper ${isCircularLoop ? 'loop-detected' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {/* Toggle Expand Arrow */}
        {hasChildren && !isCircularLoop ? (
          <button 
            type="button" 
            className="dep-tree-expand-btn"
            onClick={handleToggle}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon expanded={expanded} />
          </button>
        ) : (
          <span className="dep-tree-expand-spacer" />
        )}

        {/* Node File Row */}
        <div className="dep-tree-row-content" onClick={handleNodeClick}>
          <FileIcon extension={node.extension} />
          
          <div className="dep-tree-labels">
            <span className="dep-tree-label-main">{node.label}</span>
            <span className="dep-tree-label-sub">{node.relativePath}</span>
          </div>

          {/* Badges and Actions */}
          <div className="dep-tree-actions" onClick={(e) => e.stopPropagation()}>
            {node.isCircular && (
              <span className="dep-tree-badge circular" title="Circular dependency detected">
                circular
              </span>
            )}
            {isCircularLoop && (
              <span className="dep-tree-badge loop" title="Recursive import loop prevented">
                <WarningIcon /> Loop
              </span>
            )}
            
            {/* Center/Focus target button */}
            <button
              type="button"
              className="dep-tree-focus-btn"
              title={`Focus on ${node.label}`}
              onClick={() => onSelectNode(node.id)}
            >
              <FocusIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Nested Children rendering */}
      {expanded && hasChildren && !isCircularLoop && (
        <div className="dep-tree-children-container">
          {children.map((child) => (
            <DependencyTreeNode
              key={child.id}
              nodeId={child.id}
              index={index}
              direction={direction}
              visitedIds={nextVisitedIds}
              onSelectNode={onSelectNode}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
