import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ExplorerToolbar } from './components/ExplorerToolbar.js';
import { FileTreeView, type FileTreeRowData } from './components/FileTreeView.js';
import { MillerColumnsPanel } from './components/MillerColumnsPanel.js';
import { FileCodeViewer } from './components/FileCodeViewer.js';
import { SelectionPanel } from './components/SelectionPanel.js';
import { useGraphData } from './hooks/useGraphData.js';
import { useRelationshipIndex } from './hooks/useRelationshipIndex.js';
import {
  getAncestorIds,
  getFolderSummary,
  type FileRelationshipIndex,
} from './relationshipIndex.js';
import type {
  DependencyFilters,
  ExplorerGraphNode,
  GraphMode,
} from './types.js';

const SOURCE_LABELS = {
  window: 'embedded data',
  http: 'live server',
  sample: 'sample preview',
} as const;



function buildInitialExpandedIds(index: FileRelationshipIndex): Set<string> {
  const expandedIds = new Set<string>();

  for (const node of index.structureGraph?.nodes ?? []) {
    if (node.kind === 'directory' && node.depth <= 1) {
      expandedIds.add(node.id);
    }
  }

  if (index.rootId) {
    expandedIds.add(index.rootId);
  }

  return expandedIds;
}

function firstSelectableNode(index: FileRelationshipIndex): ExplorerGraphNode | null {
  if (index.rootId) {
    return index.nodeById.get(index.rootId) ?? null;
  }

  return Array.from(index.nodeById.values())[0] ?? null;
}

function buildTreeRows(
  index: FileRelationshipIndex,
  expandedIds: Set<string>,
  searchTerm: string,
  filters: DependencyFilters,
): FileTreeRowData[] {
  const rows: FileTreeRowData[] = [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const structureNodes = index.structureGraph?.nodes ?? Array.from(index.nodeById.values());
  const searchMatchedIds = new Set<string>();
  const searchVisibleIds = new Set<string>();
  const circularVisibleIds = new Set<string>();

  if (normalizedSearch) {
    for (const node of structureNodes) {
      if (
        node.label.toLowerCase().includes(normalizedSearch) ||
        node.relativePath.toLowerCase().includes(normalizedSearch)
      ) {
        searchMatchedIds.add(node.id);
        searchVisibleIds.add(node.id);
        for (const ancestorId of getAncestorIds(node.id, index)) {
          searchVisibleIds.add(ancestorId);
        }
      }
    }
  }

  if (filters.circularOnly) {
    for (const nodeId of index.circularNodeIds) {
      circularVisibleIds.add(nodeId);
      for (const ancestorId of getAncestorIds(nodeId, index)) {
        circularVisibleIds.add(ancestorId);
      }
    }
  }

  function shouldShowNode(nodeId: string): boolean {
    if (normalizedSearch && !searchVisibleIds.has(nodeId)) {
      return false;
    }

    if (filters.circularOnly && !circularVisibleIds.has(nodeId)) {
      return false;
    }

    return true;
  }

  function visit(node: ExplorerGraphNode, level: number) {
    if (!shouldShowNode(node.id)) {
      return;
    }

    const children = index.childrenByParentId.get(node.id) ?? [];
    const forceExpanded = Boolean(normalizedSearch) || filters.circularOnly;
    const expanded = expandedIds.has(node.id) || forceExpanded;

    rows.push({
      node,
      level,
      hasChildren: children.length > 0,
      expanded,
      matched: searchMatchedIds.has(node.id),
      circular: index.circularNodeIds.has(node.id),
    });

    if (!children.length || !expanded) {
      return;
    }

    for (const child of children) {
      visit(child, level + 1);
    }
  }

  if (index.rootId) {
    const rootNode = index.nodeById.get(index.rootId);
    if (rootNode) {
      visit(rootNode, 0);
    }
  } else {
    for (const node of structureNodes) {
      visit(node, 0);
    }
  }

  return rows;
}

export default function App() {
  const { dataSet, loading, error, source } = useGraphData();
  const index = useRelationshipIndex(dataSet);
  const [searchTerm, setSearchTerm] = useState('');
  const [circularOnly, setCircularOnly] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [millerChain, setMillerChain] = useState<string[]>([]);
  const [activeCodeNodeId, setActiveCodeNodeId] = useState<string | null>(null);
  
  const [rightColumnOrder, setRightColumnOrder] = useState<('details' | 'code')[]>(['details', 'code']);
  const [draggedStackType, setDraggedStackType] = useState<'details' | 'code' | null>(null);
  
  const [leftWidth, setLeftWidth] = useState<number>(300);
  const [rightWidth, setRightWidth] = useState<number>(400);
  const [detailsHeight, setDetailsHeight] = useState<number>(220);

  const handleStackDragStart = (type: 'details' | 'code') => {
    setDraggedStackType(type);
  };

  const handleStackDrop = (targetType: 'details' | 'code') => {
    if (draggedStackType && draggedStackType !== targetType) {
      setRightColumnOrder(prev => [prev[1], prev[0]]);
    }
    setDraggedStackType(null);
  };

  const swapStackLayout = () => {
    setRightColumnOrder(prev => [prev[1], prev[0]]);
  };

  const handleLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + delta));
      setLeftWidth(newWidth);
    };
    
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleRightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(300, Math.min(800, startWidth - delta));
      setRightWidth(newWidth);
    };
    
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleHeightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = detailsHeight;
    const isDetailsOnTop = rightColumnOrder[0] === 'details';
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = isDetailsOnTop
        ? Math.max(120, Math.min(500, startHeight + delta))
        : Math.max(120, Math.min(500, startHeight - delta));
      setDetailsHeight(newHeight);
    };
    
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const selectedNode = selectedNodeId ? (index.nodeById.get(selectedNodeId) ?? null) : null;
  const activeCodeNode = activeCodeNodeId ? (index.nodeById.get(activeCodeNodeId) ?? null) : null;

  const folderSummary = activeCodeNode?.kind === 'directory'
    ? getFolderSummary(activeCodeNode.id, index, { showTypeOnlyEdges: true, showDynamicEdges: true, circularOnly })
    : null;
  const visibleRows = useMemo(() => (
    buildTreeRows(index, expandedIds, deferredSearchTerm, { showTypeOnlyEdges: true, showDynamicEdges: true, circularOnly })
  ), [deferredSearchTerm, circularOnly, expandedIds, index]);

  useEffect(() => {
    if (selectedNodeId) {
      setMillerChain([selectedNodeId]);
      setActiveCodeNodeId(selectedNodeId);
    } else {
      setMillerChain([]);
      setActiveCodeNodeId(null);
    }
  }, [selectedNodeId]);

  useEffect(() => {
    setExpandedIds(buildInitialExpandedIds(index));
    setSelectedNodeId(firstSelectableNode(index)?.id ?? null);
  }, [index]);



  useEffect(() => {
    if (!visibleRows.length) {
      setSelectedNodeId(null);
      return;
    }

    if (!selectedNodeId || !visibleRows.some((row) => row.node.id === selectedNodeId)) {
      setSelectedNodeId(visibleRows[0]?.node.id ?? null);
    }
  }, [selectedNodeId, visibleRows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isField = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement;

      if (event.key === 'Escape' && !isField) {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function selectAndExpandNode(nodeId: string) {
    setSearchTerm('');
    const ancestors = getAncestorIds(nodeId, index);
    if (ancestors.length > 0) {
      setExpandedIds((current) => {
        const next = new Set(current);
        ancestors.forEach((id) => next.add(id));
        return next;
      });
    }
    setSelectedNodeId(nodeId);
  }

  function toggleFolder(nodeId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <main className="app-shell loading-state">
        <section className="loading-panel">
          <p className="eyebrow">Preparing explorer</p>
          <h1>Loading project data</h1>
          <p>Waiting for graph data from the CLI or embedded HTML export.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ExplorerToolbar
        sourceLabel={SOURCE_LABELS[source]}
        searchTerm={searchTerm}
        totalFiles={index.structureGraph?.totalFiles ?? index.dependencyGraph?.totalFiles ?? 0}
        totalDirs={index.structureGraph?.totalDirs ?? 0}
        totalImports={index.dependencyGraph?.totalImports ?? 0}
        circularCount={index.circularNodeIds.size}
        visibleRows={visibleRows.length}
        circularOnly={circularOnly}
        onSearchChange={(nextSearch) => {
          startTransition(() => setSearchTerm(nextSearch));
        }}
        onCircularOnlyChange={setCircularOnly}
      />

      <div 
        className="explorer-grid"
        style={{
          gridTemplateColumns: `${leftWidth}px 6px 1fr 6px ${rightWidth}px`
        }}
      >
        {/* Column 1 (Left) - Anchored Explorer */}
        <FileTreeView
          rows={visibleRows}
          selectedNodeId={selectedNodeId}
          onSelectNode={selectAndExpandNode}
          onToggleFolder={toggleFolder}
        />

        {/* Resizer 1 */}
        <div className="resizer vertical" onMouseDown={handleLeftResize}></div>

        {/* Column 2 (Center) - Anchored Miller Columns */}
        <div className="center-column">
          <MillerColumnsPanel
            node={selectedNode}
            index={index}
            chain={millerChain}
            onChainChange={setMillerChain}
            onActiveNodeChange={setActiveCodeNodeId}
          />
        </div>

        {/* Resizer 2 */}
        <div className="resizer vertical" onMouseDown={handleRightResize}></div>

        {/* Column 3 (Right) - Stacked Details & Code Viewer */}
        <div 
          className="right-column-container"
          style={{ 
            display: 'grid', 
            gridTemplateRows: rightColumnOrder[0] === 'details' 
              ? `${detailsHeight}px 6px 1fr` 
              : `1fr 6px ${detailsHeight}px`, 
            height: '100%', 
            minHeight: 0 
          }}
        >
          {rightColumnOrder.map((type, idx) => {
            if (type === 'details') {
              return (
                <React.Fragment key="details">
                  <SelectionPanel
                    node={activeCodeNode}
                    index={index}
                    folderSummary={folderSummary}
                    projectRoot={index.projectRoot}
                    error={error}
                    onDragStart={() => handleStackDragStart('details')}
                    onDrop={() => handleStackDrop('details')}
                    onSwap={swapStackLayout}
                  />
                  {idx === 0 && (
                    <div 
                      className="resizer horizontal" 
                      onMouseDown={handleHeightResize}
                    ></div>
                  )}
                </React.Fragment>
              );
            } else {
              return (
                <React.Fragment key="code">
                  <FileCodeViewer
                    node={activeCodeNode}
                    index={index}
                    onSelectNode={selectAndExpandNode}
                    eligibleTabs={millerChain}
                    activeTabId={activeCodeNodeId}
                    onTabSelect={setActiveCodeNodeId}
                    onDragStart={() => handleStackDragStart('code')}
                    onDrop={() => handleStackDrop('code')}
                    onSwap={swapStackLayout}
                  />
                  {idx === 0 && (
                    <div 
                      className="resizer horizontal" 
                      onMouseDown={handleHeightResize}
                    ></div>
                  )}
                </React.Fragment>
              );
            }
          })}
        </div>
      </div>
    </main>
  );
}
