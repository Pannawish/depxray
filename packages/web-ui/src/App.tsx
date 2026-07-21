import { Fragment, startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ExplorerToolbar } from './components/ExplorerToolbar.js';
import { FileTreeView, type FileTreeRowData } from './components/FileTreeView.js';
import { MillerColumnsPanel } from './components/MillerColumnsPanel.js';
import { ForceGraphView } from './components/ForceGraphView.js';
import { FileCodeViewer } from './components/FileCodeViewer.js';
import { SelectionPanel } from './components/SelectionPanel.js';
import { DashboardView } from './components/DashboardView.js';
import { useGraphData } from './hooks/useGraphData.js';
import { useRelationshipIndex } from './hooks/useRelationshipIndex.js';
import type { GraphColorMode } from './graphColors.js';
import {
  getFileNeighborhoodGraph,
  getFolderBoundaryGraph,
  getGraphBreadcrumbs,
  getShortestDependencyPath,
} from './graphScope.js';
import {
  getAncestorIds,
  getFolderSummary,
  getImpactSummary,
  type FileRelationshipIndex,
} from './relationshipIndex.js';
import type {
  DependencyFilters,
  ExplorerGraphNode,
  FileNeighborhoodDepth,
  FolderBoundaryMode,
  GraphMode,
  GraphScopeMode,
} from './types.js';

const SOURCE_LABELS = {
  window: 'embedded data',
  http: 'live server',
  live: 'live server',
  sample: 'sample preview',
} as const;

const EMPTY_ID_SET = new Set<string>();

type CenterViewMode = 'miller' | 'graph' | 'dashboard';

function hasUnusedExports(node: ExplorerGraphNode): boolean {
  return (node.unusedExports?.length ?? 0) > 0;
}



function buildInitialExpandedIds(index: FileRelationshipIndex): Set<string> {
  const expandedIds = new Set<string>();

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

function scopeModeForNode(
  node: ExplorerGraphNode | null | undefined,
  index: FileRelationshipIndex,
): GraphScopeMode {
  if (node?.kind === 'file' && index.dependencyNodeById.has(node.id)) {
    return 'file';
  }
  if (node?.kind === 'directory' && node.id !== index.rootId && index.dependencyGraph) {
    return 'folder';
  }
  return 'project';
}

function buildTreeRows(
  index: FileRelationshipIndex,
  expandedIds: Set<string>,
  searchTerm: string,
  filters: DependencyFilters,
): FileTreeRowData[] {
  const rows: FileTreeRowData[] = [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const structureNodes = Array.from(index.nodeById.values());
  const searchMatchedIds = new Set<string>();
  const searchVisibleIds = new Set<string>();
  const circularVisibleIds = new Set<string>();
  const orphanVisibleIds = new Set<string>();
  const unusedExportVisibleIds = new Set<string>();

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

  if (filters.orphanOnly) {
    for (const nodeId of index.orphanNodeIds) {
      orphanVisibleIds.add(nodeId);
      for (const ancestorId of getAncestorIds(nodeId, index)) {
        orphanVisibleIds.add(ancestorId);
      }
    }
  }

  if (filters.unusedExportsOnly) {
    for (const nodeId of index.unusedExportNodeIds) {
      unusedExportVisibleIds.add(nodeId);
      for (const ancestorId of getAncestorIds(nodeId, index)) {
        unusedExportVisibleIds.add(ancestorId);
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

    if (filters.orphanOnly && !orphanVisibleIds.has(nodeId)) {
      return false;
    }

    if (filters.unusedExportsOnly && !unusedExportVisibleIds.has(nodeId)) {
      return false;
    }

    return true;
  }

  function visit(node: ExplorerGraphNode, level: number) {
    if (!shouldShowNode(node.id)) {
      return;
    }

    const children = index.childrenByParentId.get(node.id) ?? [];
    const forceExpanded = Boolean(normalizedSearch)
      || filters.circularOnly
      || filters.orphanOnly
      || Boolean(filters.unusedExportsOnly);
    const expanded = expandedIds.has(node.id) || forceExpanded;

    rows.push({
      node,
      level,
      hasChildren: children.length > 0,
      expanded,
      matched: searchMatchedIds.has(node.id),
      circular: index.circularNodeIds.has(node.id),
      orphan: index.orphanNodeIds.has(node.id),
      unusedExports: hasUnusedExports(node),
      unresolvedImports: (node.unresolvedImports?.length ?? 0) > 0,
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

function buildGraphNodes(
  index: FileRelationshipIndex,
  graphMode: GraphMode,
  searchTerm: string,
  filters: DependencyFilters,
): ExplorerGraphNode[] {
  const sourceNodes = graphMode === 'dependencies'
    ? (index.dependencyGraph?.nodes ?? [])
    : (index.structureGraph?.nodes ?? []);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleIds = new Set<string>();

  if (!normalizedSearch && !filters.circularOnly && !filters.orphanOnly && !filters.unusedExportsOnly) {
    return sourceNodes.map((node) => index.nodeById.get(node.id) ?? node);
  }

  if (normalizedSearch) {
    for (const node of sourceNodes) {
      if (
        node.label.toLowerCase().includes(normalizedSearch) ||
        node.relativePath.toLowerCase().includes(normalizedSearch)
      ) {
        visibleIds.add(node.id);

        if (graphMode === 'structure') {
          for (const ancestorId of getAncestorIds(node.id, index)) {
            visibleIds.add(ancestorId);
          }
        }
      }
    }
  }

  if (filters.circularOnly) {
    for (const nodeId of index.circularNodeIds) {
      visibleIds.add(nodeId);

      if (graphMode === 'structure') {
        for (const ancestorId of getAncestorIds(nodeId, index)) {
          visibleIds.add(ancestorId);
        }
      }
    }
  }

  if (filters.orphanOnly) {
    for (const nodeId of index.orphanNodeIds) {
      visibleIds.add(nodeId);

      if (graphMode === 'structure') {
        for (const ancestorId of getAncestorIds(nodeId, index)) {
          visibleIds.add(ancestorId);
        }
      }
    }
  }

  if (filters.unusedExportsOnly) {
    for (const nodeId of index.unusedExportNodeIds) {
      visibleIds.add(nodeId);

      if (graphMode === 'structure') {
        for (const ancestorId of getAncestorIds(nodeId, index)) {
          visibleIds.add(ancestorId);
        }
      }
    }
  }

  return sourceNodes
    .map((node) => index.nodeById.get(node.id) ?? node)
    .filter((node) => visibleIds.has(node.id));
}

export default function App() {
  const { dataSet, loading, error, source } = useGraphData();
  const index = useRelationshipIndex(dataSet);
  const [searchTerm, setSearchTerm] = useState('');
  const [circularOnly, setCircularOnly] = useState<boolean>(false);
  const [orphanOnly, setOrphanOnly] = useState<boolean>(false);
  const [unusedExportsOnly, setUnusedExportsOnly] = useState<boolean>(false);
  const [centerViewMode, setCenterViewMode] = useState<CenterViewMode>('graph');
  const [graphColorMode, setGraphColorMode] = useState<GraphColorMode>('extension');
  const [graphLabelMode, setGraphLabelMode] = useState<'smart' | 'all' | 'none'>('smart');
  const [graphScopeMode, setGraphScopeMode] = useState<GraphScopeMode>('project');
  const [fileNeighborhoodDepth, setFileNeighborhoodDepth] = useState<FileNeighborhoodDepth>(1);
  const [folderBoundaryMode, setFolderBoundaryMode] = useState<FolderBoundaryMode>('all');
  const [dependencyPathTargetId, setDependencyPathTargetId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [millerChain, setMillerChain] = useState<string[]>([]);
  const [activeCodeNodeId, setActiveCodeNodeId] = useState<string | null>(null);
  
  const [columnsOrder, setColumnsOrder] = useState<('explorer' | 'details')[]>(['explorer', 'details']);
  const [rightColumnOrder, setRightColumnOrder] = useState<('details' | 'code')[]>(['code', 'details']);
  const [draggedType, setDraggedType] = useState<'explorer' | 'details' | 'code' | null>(null);
  
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [rightWidth, setRightWidth] = useState<number | null>(null);
  const [detailsHeight, setDetailsHeight] = useState<number | null>(null);

  const swapHorizontalLayout = () => {
    setColumnsOrder(prev => [prev[1], prev[0]]);
  };

  const swapVerticalLayout = () => {
    setRightColumnOrder(prev => [prev[1], prev[0]]);
  };

  const handleExplorerDrop = () => {
    if (draggedType === 'details' || draggedType === 'code') {
      swapHorizontalLayout();
    }
    setDraggedType(null);
  };

  const handleDetailsDrop = () => {
    if (draggedType === 'explorer') {
      swapHorizontalLayout();
    } else if (draggedType === 'code') {
      swapVerticalLayout();
    }
    setDraggedType(null);
  };

  const handleCodeDrop = () => {
    if (draggedType === 'explorer') {
      swapHorizontalLayout();
    } else if (draggedType === 'details') {
      swapVerticalLayout();
    }
    setDraggedType(null);
  };

  const handleLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const element = document.querySelector('.tree-panel') ?? document.querySelector('.right-column-container');
    const startWidth = leftWidth ?? (element ? element.getBoundingClientRect().width : 360);
    const maxLeft = Math.floor(window.innerWidth * 0.45);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(maxLeft, startWidth + delta));
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
    const element = document.querySelector('.right-column-container') ?? document.querySelector('.tree-panel:last-child');
    const startWidth = rightWidth ?? (element ? element.getBoundingClientRect().width : 480);
    const maxRight = Math.floor(window.innerWidth * 0.55);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(maxRight, startWidth - delta));
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
    const element = document.querySelector('.details-panel');
    const startHeight = detailsHeight ?? (element ? element.getBoundingClientRect().height : 260);
    const isDetailsOnTop = rightColumnOrder[0] === 'details';
    const container = document.querySelector('.right-column-container');
    const maxH = container ? Math.floor(container.getBoundingClientRect().height * 0.8) : 600;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = isDetailsOnTop
        ? Math.max(100, Math.min(maxH, startHeight + delta))
        : Math.max(100, Math.min(maxH, startHeight - delta));
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
  const dependencyFilters = useMemo<DependencyFilters>(() => ({
    showTypeOnlyEdges: true,
    showDynamicEdges: true,
    circularOnly,
    orphanOnly,
    unusedExportsOnly,
  }), [circularOnly, orphanOnly, unusedExportsOnly]);

  const folderSummary = activeCodeNode?.kind === 'directory'
    ? getFolderSummary(activeCodeNode.id, index, dependencyFilters)
    : null;
  const visibleRows = useMemo(() => (
    buildTreeRows(index, expandedIds, deferredSearchTerm, dependencyFilters)
  ), [deferredSearchTerm, dependencyFilters, expandedIds, index]);
  const canUseFileScope = Boolean(selectedNode?.kind === 'file' && index.dependencyNodeById.has(selectedNode.id));
  const folderScopeNode = selectedNode?.kind === 'directory'
    ? selectedNode
    : selectedNode
      ? index.nodeById.get(index.parentById.get(selectedNode.id) ?? '') ?? null
      : null;
  const canUseFolderScope = Boolean(folderScopeNode?.kind === 'directory' && index.dependencyGraph);
  const graphMode: GraphMode = index.dependencyGraph && (
    graphScopeMode !== 'project' || dataSet?.defaultMode === 'dependencies'
  ) ? 'dependencies' : 'structure';
  const projectGraphNodes = useMemo(() => (
    buildGraphNodes(index, graphMode, deferredSearchTerm, dependencyFilters)
  ), [deferredSearchTerm, dependencyFilters, graphMode, index]);
  const projectGraphEdges = useMemo(() => (
    graphMode === 'dependencies'
      ? index.dependencyEdges
      : (index.structureGraph?.edges ?? [])
  ), [graphMode, index.dependencyEdges, index.structureGraph]);
  const scopedGraph = useMemo(() => {
    if (graphScopeMode === 'file' && selectedNode?.kind === 'file') {
      return getFileNeighborhoodGraph(
        selectedNode.id,
        index,
        fileNeighborhoodDepth,
        dependencyFilters,
      );
    }

    if (graphScopeMode === 'folder' && folderScopeNode?.kind === 'directory') {
      return getFolderBoundaryGraph(
        folderScopeNode.id,
        index,
        folderBoundaryMode,
        dependencyFilters,
      );
    }

    return {
      nodes: projectGraphNodes,
      edges: projectGraphEdges,
      focusNodeId: selectedNodeId,
    };
  }, [
    dependencyFilters,
    fileNeighborhoodDepth,
    folderBoundaryMode,
    folderScopeNode,
    graphScopeMode,
    index,
    projectGraphEdges,
    projectGraphNodes,
    selectedNode,
    selectedNodeId,
  ]);
  const visibleGraphNodes = scopedGraph.nodes;
  const visibleGraphEdges = scopedGraph.edges;
  const graphBreadcrumbs = useMemo(() => {
    const anchorId = graphScopeMode === 'folder'
      ? folderScopeNode?.id ?? null
      : graphScopeMode === 'file'
        ? selectedNode?.id ?? null
        : index.rootId;
    return getGraphBreadcrumbs(anchorId, index);
  }, [folderScopeNode?.id, graphScopeMode, index, selectedNode?.id]);
  const dependencyPathResult = useMemo(() => (
    selectedNode?.kind === 'file' && dependencyPathTargetId
      ? getShortestDependencyPath(selectedNode.id, dependencyPathTargetId, index, dependencyFilters)
      : null
  ), [dependencyFilters, dependencyPathTargetId, index, selectedNode]);
  const dependencyPathNodeIds = useMemo(() => (
    new Set(dependencyPathResult?.nodeIds ?? [])
  ), [dependencyPathResult]);
  const dependencyPathEdgeIds = useMemo(() => (
    new Set(dependencyPathResult?.edgeIds ?? [])
  ), [dependencyPathResult]);
  const dependencyPathLabel = useMemo(() => {
    if (!dependencyPathResult || !dependencyPathTargetId || selectedNode?.kind !== 'file') {
      return null;
    }
    const target = index.nodeById.get(dependencyPathTargetId);
    if (!target) {
      return null;
    }
    if (!dependencyPathResult.connected) {
      return `No dependency path: ${selectedNode.label} ↔ ${target.label}`;
    }
    const from = dependencyPathResult.direction === 'forward' ? selectedNode.label : target.label;
    const to = dependencyPathResult.direction === 'forward' ? target.label : selectedNode.label;
    return `${from} → ${to} · ${dependencyPathResult.edgeIds.length} hop${dependencyPathResult.edgeIds.length === 1 ? '' : 's'}`;
  }, [dependencyPathResult, dependencyPathTargetId, index.nodeById, selectedNode]);
  const impactSummary = useMemo(() => (
    selectedNodeId ? getImpactSummary(selectedNodeId, index) : null
  ), [index, selectedNodeId]);
  const activeImpactSummary = activeCodeNode?.id === impactSummary?.targetNodeId ? impactSummary : null;
  const graphImpactNodeIds = graphMode === 'dependencies'
    ? impactSummary?.impactNodeIds ?? EMPTY_ID_SET
    : EMPTY_ID_SET;
  const graphImpactEdgeIds = graphMode === 'dependencies'
    ? impactSummary?.impactEdgeIds ?? EMPTY_ID_SET
    : EMPTY_ID_SET;

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
    setGraphScopeMode('project');
    setDependencyPathTargetId(null);
  }, [index]);



  useEffect(() => {
    if (!visibleRows.length) {
      setSelectedNodeId(null);
      return;
    }

    if (!selectedNodeId || !visibleRows.some((row) => row.node.id === selectedNodeId)) {
      const nextNode = visibleRows[0]?.node ?? null;
      setSelectedNodeId(nextNode?.id ?? null);
      setGraphScopeMode(scopeModeForNode(nextNode, index));
      setDependencyPathTargetId(null);
    }
  }, [index, selectedNodeId, visibleRows]);

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
    setDependencyPathTargetId(null);
    const node = index.nodeById.get(nodeId);
    setGraphScopeMode(scopeModeForNode(node, index));
  }

  function openNodeInCodeViewer(nodeId: string) {
    const node = index.nodeById.get(nodeId);
    if (!node || node.kind !== 'file') {
      return;
    }
    setMillerChain((current) => current.includes(nodeId) ? current : [...current, nodeId]);
    setActiveCodeNodeId(nodeId);
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

  const gridStyle = useMemo(() => {
    const isSwapped = columnsOrder[0] === 'details';
    const left = leftWidth !== null ? `${leftWidth}px` : (isSwapped ? 'minmax(300px, 1fr)' : 'minmax(240px, 360px)');
    const right = rightWidth !== null ? `${rightWidth}px` : (isSwapped ? 'minmax(240px, 360px)' : 'minmax(300px, 1fr)');
    
    return {
      gridTemplateColumns: `${left} 6px minmax(280px, 1fr) 6px ${right}`,
      gap: 0
    };
  }, [leftWidth, rightWidth, columnsOrder]);

  const rightColumnStyle = useMemo(() => {
    const isDetailsOnTop = rightColumnOrder[0] === 'details';
    
    if (detailsHeight === null) {
      return {
        display: 'grid',
        gridTemplateRows: isDetailsOnTop ? 'auto 6px 1fr' : '1fr 6px auto',
        gap: 0,
        height: '100%',
        minHeight: 0
      };
    }
    
    return {
      display: 'grid',
      gridTemplateRows: isDetailsOnTop
        ? `${detailsHeight}px 6px 1fr`
        : `1fr 6px ${detailsHeight}px`,
      gap: 0,
      height: '100%',
      minHeight: 0
    };
  }, [detailsHeight, rightColumnOrder]);

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
        orphanCount={index.orphanNodeIds.size}
        unusedExportCount={index.unusedExportNodeIds.size}
        visibleRows={visibleRows.length}
        circularOnly={circularOnly}
        orphanOnly={orphanOnly}
        unusedExportsOnly={unusedExportsOnly}
        centerViewMode={centerViewMode}
        onSearchChange={(nextSearch) => {
          startTransition(() => setSearchTerm(nextSearch));
        }}
        onCircularOnlyChange={setCircularOnly}
        onOrphanOnlyChange={setOrphanOnly}
        onUnusedExportsOnlyChange={setUnusedExportsOnly}
        onCenterViewModeChange={setCenterViewMode}
      />

      <div 
        className="explorer-grid"
        style={gridStyle}
      >
        {/* Column 1 (Left) */}
        {columnsOrder[0] === 'explorer' ? (
          <FileTreeView
            rows={visibleRows}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectAndExpandNode}
            onToggleFolder={toggleFolder}
            onDragStart={() => setDraggedType('explorer')}
            onDrop={handleExplorerDrop}
            onSwap={swapHorizontalLayout}
          />
        ) : (
          <div 
            className="right-column-container"
            style={rightColumnStyle}
          >
            {rightColumnOrder.map((type, idx) => {
              if (type === 'details') {
                return (
                  <Fragment key="details">
                    <SelectionPanel
                      node={activeCodeNode}
                      index={index}
                      folderSummary={folderSummary}
                      impactSummary={activeImpactSummary}
                      projectRoot={index.projectRoot}
                      error={error}
                      onDragStart={() => setDraggedType('details')}
                      onDrop={handleDetailsDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div 
                        className="resizer horizontal" 
                        onMouseDown={handleHeightResize}
                      ></div>
                    )}
                  </Fragment>
                );
              } else {
                return (
                  <Fragment key="code">
                    <FileCodeViewer
                      node={activeCodeNode}
                      index={index}
                      onSelectNode={selectAndExpandNode}
                      eligibleTabs={millerChain}
                      activeTabId={activeCodeNodeId}
                      onTabSelect={setActiveCodeNodeId}
                      onDragStart={() => setDraggedType('code')}
                      onDrop={handleCodeDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div 
                        className="resizer horizontal" 
                        onMouseDown={handleHeightResize}
                      ></div>
                    )}
                  </Fragment>
                );
              }
            })}
          </div>
        )}

        {/* Resizer 1 */}
        <div className="resizer vertical" onMouseDown={handleLeftResize}></div>

        {/* Column 2 (Center) - Anchored Miller Columns */}
        <div className="center-column">
          {centerViewMode === 'dashboard' ? (
            <DashboardView
              index={index}
              healthScore={dataSet?.graphs.dependencies?.healthScore}
              onSelectNode={selectAndExpandNode}
            />
          ) : centerViewMode === 'miller' ? (
            <MillerColumnsPanel
              node={selectedNode}
              index={index}
              chain={millerChain}
              onChainChange={setMillerChain}
              onActiveNodeChange={setActiveCodeNodeId}
            />
          ) : (
            <ForceGraphView
              nodes={visibleGraphNodes}
              edges={visibleGraphEdges}
              selectedNodeId={selectedNodeId}
              circularNodeIds={index.circularNodeIds}
              orphanNodeIds={index.orphanNodeIds}
              impactNodeIds={graphImpactNodeIds}
              impactEdgeIds={graphImpactEdgeIds}
              impactAffectedCount={graphMode === 'dependencies' ? impactSummary?.affectedCount ?? 0 : 0}
              dependencyPathNodeIds={dependencyPathNodeIds}
              dependencyPathEdgeIds={dependencyPathEdgeIds}
              dependencyPathTargetId={dependencyPathTargetId}
              dependencyPathResult={dependencyPathResult}
              dependencyPathLabel={dependencyPathLabel}
              graphMode={graphMode}
              scopeMode={graphScopeMode}
              canUseFolderScope={canUseFolderScope}
              canUseFileScope={canUseFileScope}
              neighborhoodDepth={fileNeighborhoodDepth}
              folderBoundaryMode={folderBoundaryMode}
              breadcrumbs={graphBreadcrumbs}
              labelMode={graphLabelMode}
              onLabelModeChange={setGraphLabelMode}
              colorMode={graphColorMode}
              onColorModeChange={setGraphColorMode}
              onScopeModeChange={(mode) => {
                setGraphScopeMode(mode);
                setDependencyPathTargetId(null);
              }}
              onNeighborhoodDepthChange={setFileNeighborhoodDepth}
              onFolderBoundaryModeChange={setFolderBoundaryMode}
              onBreadcrumbSelect={selectAndExpandNode}
              onDependencyPathTargetChange={setDependencyPathTargetId}
              onOpenNode={openNodeInCodeViewer}
              onSelectNode={selectAndExpandNode}
            />
          )}
        </div>

        {/* Resizer 2 */}
        <div className="resizer vertical" onMouseDown={handleRightResize}></div>

        {/* Column 3 (Right) */}
        {columnsOrder[1] === 'explorer' ? (
          <FileTreeView
            rows={visibleRows}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectAndExpandNode}
            onToggleFolder={toggleFolder}
            onDragStart={() => setDraggedType('explorer')}
            onDrop={handleExplorerDrop}
            onSwap={swapHorizontalLayout}
          />
        ) : (
          <div 
            className="right-column-container"
            style={rightColumnStyle}
          >
            {rightColumnOrder.map((type, idx) => {
              if (type === 'details') {
                return (
                  <Fragment key="details">
                    <SelectionPanel
                      node={activeCodeNode}
                      index={index}
                      folderSummary={folderSummary}
                      impactSummary={activeImpactSummary}
                      projectRoot={index.projectRoot}
                      error={error}
                      onDragStart={() => setDraggedType('details')}
                      onDrop={handleDetailsDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div 
                        className="resizer horizontal" 
                        onMouseDown={handleHeightResize}
                      ></div>
                    )}
                  </Fragment>
                );
              } else {
                return (
                  <Fragment key="code">
                    <FileCodeViewer
                      node={activeCodeNode}
                      index={index}
                      onSelectNode={selectAndExpandNode}
                      eligibleTabs={millerChain}
                      activeTabId={activeCodeNodeId}
                      onTabSelect={setActiveCodeNodeId}
                      onDragStart={() => setDraggedType('code')}
                      onDrop={handleCodeDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div 
                        className="resizer horizontal" 
                        onMouseDown={handleHeightResize}
                      ></div>
                    )}
                  </Fragment>
                );
              }
            })}
          </div>
        )}
      </div>
    </main>
  );
}
