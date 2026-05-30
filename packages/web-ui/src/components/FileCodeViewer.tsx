import React, { useState, useEffect } from 'react';
import type { ExplorerGraphNode } from '../types.js';
import type { FileRelationshipIndex } from '../relationshipIndex.js';

interface FileCodeViewerProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  onSelectNode: (nodeId: string) => void;
  eligibleTabs: string[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onDragStart: () => void;
  onDrop: () => void;
  onSwapVertical: () => void;
  onSwapHorizontal: () => void;
}

export function FileCodeViewer({
  node,
  index,
  onSelectNode,
  eligibleTabs,
  activeTabId,
  onTabSelect,
  onDragStart,
  onDrop,
  onSwapVertical,
  onSwapHorizontal,
}: FileCodeViewerProps) {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node || node.kind === 'directory') {
      setCode('');
      setError(null);
      return;
    }

    // Check if we are in static-export mode where live fetch is unavailable
    if (window.__GRAPH_DATA_SET__ && !window.location.origin.includes('127.0.0.1') && !window.location.origin.includes('localhost')) {
      setCode('');
      setError('Code preview is only available in live CLI server mode, not in static HTML exports.');
      return;
    }

    let active = true;
    async function fetchFileContent() {
      setLoading(true);
      setError(null);
      setCode('');
      try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(node.relativePath)}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'File not found on disk' : `Server responded with ${response.status}`);
        }
        const text = await response.text();
        if (active) {
          setCode(text);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchFileContent();

    return () => {
      active = false;
    };
  }, [node]);

  if (!node) {
    return (
      <section className="code-viewer-panel empty-state">
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
              <p className="eyebrow">Source Code</p>
              <h2>No file selected</h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="swap-layout-btn"
              onClick={onSwapVertical}
              title="Swap vertical layout with Details Panel"
              type="button"
            >
              ⇅
            </button>
            <button 
              className="swap-layout-btn"
              onClick={onSwapHorizontal}
              title="Swap horizontal column with Project Tree"
              type="button"
            >
              ⇄
            </button>
          </div>
        </div>
        <div className="code-viewer-content empty">
          <p className="empty-copy">Select a file in the project explorer to view its source code and trace imports.</p>
        </div>
      </section>
    );
  }

  // Get outgoing imports (dependencies)
  const outgoing = index.importsBySourceId.get(node.id) || [];
  // Get incoming dependents
  const incoming = index.importedByTargetId.get(node.id) || [];

  // Parse lines and build lookup for outgoing imports
  const lines = code.split(/\r?\n/);
  
  // Highlighting map: line index -> edge
  const importLineMap = new Map<number, typeof outgoing[0]>();
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ') && !trimmed.includes('import(')) return;

    // Find if any outgoing edge has its import specifier mentioned on this line
    const match = outgoing.find(edge => {
      if (!edge.importSpecifier) return false;
      const spec = edge.importSpecifier;
      // Match inside quotes or backticks to avoid substring collisions
      return line.includes(`'${spec}'`) || 
             line.includes(`"${spec}"`) || 
             line.includes(`\`${spec}\``) ||
             // Fallback to substring if specifier matches closely
             line.includes(spec);
    });

    if (match) {
      importLineMap.set(index, match);
    }
  });

  return (
    <section className="code-viewer-panel">
      <div 
        className="panel-header inline draggable" 
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => e.preventDefault()} 
        onDrop={onDrop}
        style={{ cursor: 'grab' }}
      >
        <div className="drag-handle-layout">
          <div className="drag-handle">⋮⋮</div>
          <div>
            <p className="eyebrow">{node.kind === 'directory' ? 'Folder' : 'Code Viewer'}</p>
            <h2>{node.label}</h2>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="code-viewer-stats">
            {node.kind === 'directory'
              ? `${index.childrenByParentId.get(node.id)?.length || 0} items`
              : `${outgoing.length} imports • ${incoming.length} dependents`}
          </span>
          <button 
            className="swap-layout-btn"
            onClick={onSwapVertical}
            title="Swap vertical layout with Details Panel"
            type="button"
          >
            ⇅
          </button>
          <button 
            className="swap-layout-btn"
            onClick={onSwapHorizontal}
            title="Swap horizontal column with Project Tree"
            type="button"
          >
            ⇄
          </button>
        </div>
      </div>

      {eligibleTabs.length > 1 && (
        <div className="code-tabs-bar">
          {eligibleTabs.map(tabId => {
            const tabNode = index.nodeById.get(tabId) ?? index.structureNodeById.get(tabId);
            if (!tabNode) return null;
            const isActive = tabId === activeTabId;
            return (
              <button
                key={tabId}
                className={`code-tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabSelect(tabId)}
                title={tabNode.relativePath}
              >
                <span className="code-tab-icon">{tabNode.kind === 'directory' ? '📁' : '📄'}</span>
                <span className="code-tab-name">{tabNode.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="code-viewer-body">
        {node.kind === 'directory' ? (
          <div className="code-state-msg directory-view">
            <p className="title">Folder: {node.relativePath}</p>
            <p className="desc">
              Select a file tab above or explore the dependency columns to view source code.
            </p>
          </div>
        ) : (
          <>
            {/* Dependents Pill Badges */}
            {incoming.length > 0 && (
              <div className="dependents-bar">
                <span className="bar-label">Imported by:</span>
                <div className="dependents-list">
                  {incoming.map(edge => {
                    const srcNode = index.structureNodeById.get(edge.source);
                    if (!srcNode) return null;
                    return (
                      <button 
                        key={edge.source}
                        className="dependent-badge"
                        onClick={() => onSelectNode(edge.source)}
                        title={srcNode.relativePath}
                      >
                        📄 {srcNode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="code-state-msg loading">
                <div className="spinner"></div>
                <p>Fetching file contents...</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="code-state-msg error">
                <p className="title">Could not load code</p>
                <p className="desc">{error}</p>
              </div>
            )}

            {/* Code display */}
            {!loading && !error && code && (
              <div className="code-editor-container">
                <div className="code-editor-pre">
                  {lines.map((line, lineIdx) => {
                    const isImport = importLineMap.has(lineIdx);
                    const matchingEdge = importLineMap.get(lineIdx);
                    const isExport = /^[ \t]*export\b/.test(line);
                    
                    let lineClass = 'code-line';
                    if (isImport) lineClass += ' highlight-import';
                    if (isExport) lineClass += ' highlight-export';

                    const targetNode = matchingEdge ? index.structureNodeById.get(matchingEdge.target) : null;

                    return (
                      <div key={lineIdx} className={lineClass}>
                        <span className="line-num">{lineIdx + 1}</span>
                        <span className="line-content">{line || ' '}</span>
                        
                        {/* Navigation badge for imports */}
                        {isImport && targetNode && (
                          <button
                            className="code-nav-btn"
                            onClick={() => onSelectNode(targetNode.id)}
                            title={`Navigate to ${targetNode.relativePath}`}
                          >
                            → Go to {targetNode.label}
                          </button>
                        )}

                        {/* Badge for exports */}
                        {isExport && (
                          <span className="code-export-badge">
                            Export
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
