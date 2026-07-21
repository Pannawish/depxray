import React, { useState, useEffect, useRef } from 'react';
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
  const [millerMode, setMillerMode] = useState<'imports' | 'dependents'>('imports');
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
          <p className="empty-copy">
            Select a file in the project tree to explore its dependency chains.
          </p>
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

  const handleModeChange = (newMode: 'imports' | 'dependents') => {
    setMillerMode(newMode);
    if (node) {
      // Cleanly reset the active chain back to the main selected tree root node
      onChainChange([node.id]);
      onActiveNodeChange(node.id);
    }
  };

  const getFileIcon = (kind: 'file' | 'directory') => {
    return kind === 'directory' ? '📁' : '📄';
  };

  return (
    <section className="miller-panel">
      {/* Header with Segmented Toggle Bar */}
      <div className="panel-header inline">
        <div>
          <p className="eyebrow">Dependency Explorer</p>
          <h2>{node.label}</h2>
        </div>

        <div className="miller-toggle-bar" aria-label="Tracing direction toggle">
          <button
            className={`miller-toggle-btn ${millerMode === 'imports' ? 'active' : ''}`}
            onClick={() => handleModeChange('imports')}
            type="button"
          >
            Imports (Outgoing)
          </button>
          <button
            className={`miller-toggle-btn ${millerMode === 'dependents' ? 'active' : ''}`}
            onClick={() => handleModeChange('dependents')}
            type="button"
          >
            Dependents (Incoming)
          </button>
        </div>
      </div>

      {/* Columns List Container */}
      <div className="miller-columns-container" ref={containerRef}>
        {chain.map((chainId, colIndex) => {
          const colNode = index.structureNodeById.get(chainId);
          if (!colNode) return null;

          const isImports = millerMode === 'imports';
          const relations = isImports
            ? index.importsBySourceId.get(chainId) || []
            : index.importedByTargetId.get(chainId) || [];

          return (
            <div key={`${chainId}-${colIndex}`} className="miller-column">
              <div className="miller-column-header">
                <h3>{colNode.label}</h3>
                <span className="miller-meta">
                  {relations.length} {isImports ? 'imports' : 'dependents'}
                </span>
              </div>

              <div className="miller-column-list">
                {relations.length === 0 ? (
                  <div className="miller-empty">{isImports ? 'No imports' : 'No dependents'}</div>
                ) : (
                  relations.map((edge) => {
                    const targetId = isImports ? edge.target : edge.source;
                    const depNode = index.structureNodeById.get(targetId);
                    if (!depNode) return null;

                    const isSelected = chain[colIndex + 1] === targetId;
                    const childRelations = isImports
                      ? index.importsBySourceId.get(targetId) || []
                      : index.importedByTargetId.get(targetId) || [];
                    const hasChildren = childRelations.length > 0;

                    return (
                      <button
                        key={targetId}
                        className={`miller-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleItemClick(colIndex, targetId)}
                      >
                        <span className="miller-item-icon">{getFileIcon(depNode.kind)}</span>
                        <div className="miller-item-labels">
                          <span className="miller-item-name">{depNode.label}</span>
                        </div>
                        {hasChildren && <span className="miller-item-chevron">›</span>}
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
