import React, { useState, useEffect } from 'react';
import { DependencyTreeNode } from './DependencyTreeNode.js';
import type { FileRelationshipIndex, FolderSummary } from '../relationshipIndex.js';
import type { DependencyFilters, ExplorerGraphNode } from '../types.js';

interface FocusedTreePanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  folderSummary: FolderSummary | null;
  filters: DependencyFilters;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

// Inline SVGs for panel headers
const FullscreenIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TreeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m8 3 4 8 5-5M4 21h16M12 11v10" />
  </svg>
);

export function FocusedTreePanel({
  node,
  index,
  folderSummary,
  filters,
  selectedNodeId,
  onSelectNode,
}: FocusedTreePanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on ESC press
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  if (!node) {
    return (
      <section className="focused-tree-panel empty-state">
        <div className="panel-header">
          <p className="eyebrow">Focused dependency tree</p>
          <h2>No file selected</h2>
        </div>
        <div className="focused-tree-content empty">
          <p className="empty-copy">Select a file in the project tree to visualize its dependency hierarchy.</p>
        </div>
      </section>
    );
  }

  // Count direct imports and imported by
  const directImports = index.importsBySourceId.get(node.id) ?? [];
  const directImportedBy = index.importedByTargetId.get(node.id) ?? [];

  // Filter based on showTypeOnlyEdges and showDynamicEdges
  const filteredImports = directImports.filter(
    (edge) =>
      (filters.showTypeOnlyEdges || !edge.isTypeOnly) &&
      (filters.showDynamicEdges || !edge.isDynamic)
  );

  const filteredImportedBy = directImportedBy.filter(
    (edge) =>
      (filters.showTypeOnlyEdges || !edge.isTypeOnly) &&
      (filters.showDynamicEdges || !edge.isDynamic)
  );

  const renderTrees = (isModal: boolean) => {
    if (node.kind === 'directory') {
      const filesInDir = index.filesByFolderId.get(node.id) ?? [];
      const sortedFiles = filesInDir
        .map((fId) => index.nodeById.get(fId))
        .filter((item): item is ExplorerGraphNode => Boolean(item))
        .sort((a, b) => a.label.localeCompare(b.label));

      return (
        <div className="folder-fallback-view">
          <p className="fallback-title">
            <strong>{node.label}</strong> is a directory. Select a file below to view its dependency tree:
          </p>
          <div className="fallback-files-list">
            {sortedFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                className="fallback-file-item"
                onClick={() => onSelectNode(file.id)}
              >
                <span className="file-item-dot" />
                <span className="file-item-label">{file.label}</span>
                <span className="file-item-path">{file.relativePath}</span>
              </button>
            ))}
            {sortedFiles.length === 0 && (
              <p className="empty-copy">No files found in this directory.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`dep-tree-columns ${isModal ? 'fullscreen-columns' : ''}`}>
        {/* Left Column: Outgoing Dependencies (Imports) */}
        <div className="dep-tree-column">
          <div className="dep-tree-column-header">
            <h3>Imports ({filteredImports.length})</h3>
            <span className="subtitle-meta">Files this file imports</span>
          </div>
          <div className="dep-tree-scroller">
            {filteredImports.length > 0 ? (
              <div className="dep-tree-root">
                {filteredImports.map((edge) => (
                  <DependencyTreeNode
                    key={edge.target}
                    nodeId={edge.target}
                    index={index}
                    direction="outgoing"
                    visitedIds={new Set([node.id])}
                    onSelectNode={(targetId) => {
                      onSelectNode(targetId);
                      if (isModal) setIsFullscreen(false);
                    }}
                    depth={0}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-copy">This file does not import any other files.</p>
            )}
          </div>
        </div>

        {/* Right Column: Incoming Dependencies (Imported By) */}
        <div className="dep-tree-column">
          <div className="dep-tree-column-header">
            <h3>Imported By ({filteredImportedBy.length})</h3>
            <span className="subtitle-meta">Files that import this file</span>
          </div>
          <div className="dep-tree-scroller">
            {filteredImportedBy.length > 0 ? (
              <div className="dep-tree-root">
                {filteredImportedBy.map((edge) => (
                  <DependencyTreeNode
                    key={edge.source}
                    nodeId={edge.source}
                    index={index}
                    direction="incoming"
                    visitedIds={new Set([node.id])}
                    onSelectNode={(sourceId) => {
                      onSelectNode(sourceId);
                      if (isModal) setIsFullscreen(false);
                    }}
                    depth={0}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-copy">No other files import this file.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="focused-tree-panel">
        <div className="panel-header inline">
          <div className="panel-header-title">
            <p className="eyebrow">Focused dependency tree</p>
            <div className="panel-title-row">
              <TreeIcon />
              <h2>{node.label}</h2>
            </div>
          </div>
          <div className="panel-header-actions">
            <button
              type="button"
              className="panel-action-btn"
              title="Expand to Fullscreen"
              onClick={() => setIsFullscreen(true)}
            >
              <FullscreenIcon />
            </button>
          </div>
        </div>
        <div className="focused-tree-content">
          {renderTrees(false)}
        </div>
      </section>

      {/* Fullscreen Modal Overlay */}
      {isFullscreen && (
        <div className="dep-tree-modal-overlay">
          <div className="dep-tree-modal-container">
            <div className="dep-tree-modal-header">
              <div>
                <p className="eyebrow">Fullscreen Dependency Tree</p>
                <h2>{node.label}</h2>
                <span className="dep-tree-modal-subpath">{node.relativePath}</span>
              </div>
              <button
                type="button"
                className="dep-tree-modal-close"
                onClick={() => setIsFullscreen(false)}
                title="Close Fullscreen (Esc)"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="dep-tree-modal-body">
              {renderTrees(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
