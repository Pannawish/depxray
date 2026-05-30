import React, { useEffect, useRef } from 'react';
import type { ExplorerGraphNode } from '../types.js';
import type { FileRelationshipIndex } from '../relationshipIndex.js';

interface MillerColumnsPanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  chain: string[];
  onChainChange: (chain: string[]) => void;
  onActiveNodeChange: (nodeId: string) => void;
}

export function MillerColumnsPanel({
  node,
  index,
  chain,
  onChainChange,
  onActiveNodeChange,
}: MillerColumnsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the rightmost column when the chain grows
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [chain]);

  if (!node || chain.length === 0) {
    return (
      <section className="miller-panel empty-state">
        <div className="panel-header">
          <p className="eyebrow">Dependency Explorer</p>
          <h2>No file selected</h2>
        </div>
        <div className="miller-content empty">
          <p className="empty-copy">Select a file in the project tree to explore its dependency chains.</p>
        </div>
      </section>
    );
  }

  const handleItemClick = (columnIndex: number, targetId: string) => {
    // Truncate the chain up to this column, then add the new target
    const newChain = chain.slice(0, columnIndex + 1);
    newChain.push(targetId);
    onChainChange(newChain);
    onActiveNodeChange(targetId);
  };

  const getFileIcon = (kind: 'file' | 'directory') => {
    return kind === 'directory' ? '📁' : '📄';
  };

  return (
    <section className="miller-panel">
      <div className="panel-header">
        <p className="eyebrow">Dependency Explorer</p>
        <h2>{node.label}</h2>
      </div>
      
      <div className="miller-columns-container" ref={containerRef}>
        {chain.map((chainId, colIndex) => {
          const colNode = index.structureNodeById.get(chainId);
          if (!colNode) return null;

          // Outgoing dependencies (files that this node imports)
          const outgoingDeps = index.importsBySourceId.get(chainId) || [];
          
          return (
            <div key={`${chainId}-${colIndex}`} className="miller-column">
              <div className="miller-column-header">
                <h3>{colNode.label}</h3>
                <span className="miller-meta">{outgoingDeps.length} imports</span>
              </div>
              
              <div className="miller-column-list">
                {outgoingDeps.length === 0 ? (
                  <div className="miller-empty">No imports</div>
                ) : (
                  outgoingDeps.map(dep => {
                    const depNode = index.structureNodeById.get(dep.target);
                    if (!depNode) return null;
                    
                    // Is this item selected in the next column?
                    const isSelected = chain[colIndex + 1] === dep.target;
                    
                    // Check if it has its own imports to show a chevron
                    const hasChildren = (index.importsBySourceId.get(dep.target)?.length || 0) > 0;

                    return (
                      <button 
                        key={dep.target}
                        className={`miller-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleItemClick(colIndex, dep.target)}
                      >
                        <span className="miller-item-icon">{getFileIcon(depNode.kind)}</span>
                        <div className="miller-item-labels">
                          <span className="miller-item-name">{depNode.label}</span>
                        </div>
                        {hasChildren && (
                          <span className="miller-item-chevron">›</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
