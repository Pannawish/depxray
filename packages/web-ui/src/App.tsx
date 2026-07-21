import { Fragment, startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ExplorerToolbar } from './components/ExplorerToolbar.js';
import { FileTreeView } from './components/FileTreeView.js';
import { MillerColumnsPanel } from './components/MillerColumnsPanel.js';
import { ForceGraphView } from './components/ForceGraphView.js';
import { FileCodeViewer } from './components/FileCodeViewer.js';
import { SelectionPanel } from './components/SelectionPanel.js';
import { DashboardView } from './components/DashboardView.js';
import { useGraphData } from './hooks/useGraphData.js';
import { useRelationshipIndex } from './hooks/useRelationshipIndex.js';
import { useExplorerNavigation } from './hooks/useExplorerNavigation.js';
import { useResizableLayout } from './hooks/useResizableLayout.js';
import type { GraphColorMode } from './graphColors.js';
import { buildGraphNodes } from './explorerViewModel.js';
import {
  getFileNeighborhoodGraph,
  getFolderBoundaryGraph,
  getGraphBreadcrumbs,
  getShortestDependencyPath,
} from './graphScope.js';
import { getFolderSummary, getImpactSummary } from './relationshipIndex.js';
import type {
  DependencyFilters,
  FileNeighborhoodDepth,
  FolderBoundaryMode,
  GraphMode,
} from './types.js';

const SOURCE_LABELS = {
  window: 'embedded data',
  http: 'live server',
  live: 'live server',
  sample: 'sample preview',
} as const;

const EMPTY_ID_SET = new Set<string>();

type CenterViewMode = 'miller' | 'graph' | 'dashboard';

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
  const [fileNeighborhoodDepth, setFileNeighborhoodDepth] = useState<FileNeighborhoodDepth>(1);
  const [folderBoundaryMode, setFolderBoundaryMode] = useState<FolderBoundaryMode>('all');
  const {
    columnsOrder,
    rightColumnOrder,
    gridStyle,
    rightColumnStyle,
    startDragging,
    handleExplorerDrop,
    handleDetailsDrop,
    handleCodeDrop,
    swapHorizontalLayout,
    swapVerticalLayout,
    handleLeftResize,
    handleRightResize,
    handleHeightResize,
  } = useResizableLayout();

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const dependencyFilters = useMemo<DependencyFilters>(
    () => ({
      showTypeOnlyEdges: true,
      showDynamicEdges: true,
      circularOnly,
      orphanOnly,
      unusedExportsOnly,
    }),
    [circularOnly, orphanOnly, unusedExportsOnly],
  );
  const {
    visibleRows,
    selectedNodeId,
    selectedNode,
    activeCodeNodeId,
    activeCodeNode,
    millerChain,
    graphScopeMode,
    dependencyPathTargetId,
    setMillerChain,
    setActiveCodeNodeId,
    setGraphScopeMode,
    setDependencyPathTargetId,
    selectNode: selectAndExpandNode,
    openNode: openNodeInCodeViewer,
    toggleFolder,
  } = useExplorerNavigation(index, deferredSearchTerm, dependencyFilters, () => setSearchTerm(''));

  const folderSummary =
    activeCodeNode?.kind === 'directory'
      ? getFolderSummary(activeCodeNode.id, index, dependencyFilters)
      : null;
  const canUseFileScope = Boolean(
    selectedNode?.kind === 'file' && index.dependencyNodeById.has(selectedNode.id),
  );
  const folderScopeNode =
    selectedNode?.kind === 'directory'
      ? selectedNode
      : selectedNode
        ? (index.nodeById.get(index.parentById.get(selectedNode.id) ?? '') ?? null)
        : null;
  const canUseFolderScope = Boolean(folderScopeNode?.kind === 'directory' && index.dependencyGraph);
  const graphMode: GraphMode =
    index.dependencyGraph &&
    (graphScopeMode !== 'project' || dataSet?.defaultMode === 'dependencies')
      ? 'dependencies'
      : 'structure';
  const projectGraphNodes = useMemo(
    () => buildGraphNodes(index, graphMode, deferredSearchTerm, dependencyFilters),
    [deferredSearchTerm, dependencyFilters, graphMode, index],
  );
  const projectGraphEdges = useMemo(
    () =>
      graphMode === 'dependencies' ? index.dependencyEdges : (index.structureGraph?.edges ?? []),
    [graphMode, index.dependencyEdges, index.structureGraph],
  );
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
    const anchorId =
      graphScopeMode === 'folder'
        ? (folderScopeNode?.id ?? null)
        : graphScopeMode === 'file'
          ? (selectedNode?.id ?? null)
          : index.rootId;
    return getGraphBreadcrumbs(anchorId, index);
  }, [folderScopeNode?.id, graphScopeMode, index, selectedNode?.id]);
  const dependencyPathResult = useMemo(
    () =>
      selectedNode?.kind === 'file' && dependencyPathTargetId
        ? getShortestDependencyPath(
            selectedNode.id,
            dependencyPathTargetId,
            index,
            dependencyFilters,
          )
        : null,
    [dependencyFilters, dependencyPathTargetId, index, selectedNode],
  );
  const dependencyPathNodeIds = useMemo(
    () => new Set(dependencyPathResult?.nodeIds ?? []),
    [dependencyPathResult],
  );
  const dependencyPathEdgeIds = useMemo(
    () => new Set(dependencyPathResult?.edgeIds ?? []),
    [dependencyPathResult],
  );
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
  const impactSummary = useMemo(
    () => (selectedNodeId ? getImpactSummary(selectedNodeId, index) : null),
    [index, selectedNodeId],
  );
  const activeImpactSummary =
    activeCodeNode?.id === impactSummary?.targetNodeId ? impactSummary : null;
  const graphImpactNodeIds =
    graphMode === 'dependencies' ? (impactSummary?.impactNodeIds ?? EMPTY_ID_SET) : EMPTY_ID_SET;
  const graphImpactEdgeIds =
    graphMode === 'dependencies' ? (impactSummary?.impactEdgeIds ?? EMPTY_ID_SET) : EMPTY_ID_SET;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (event.key === 'Escape' && !isField) {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

      <div className="explorer-grid" style={gridStyle}>
        {/* Column 1 (Left) */}
        {columnsOrder[0] === 'explorer' ? (
          <FileTreeView
            rows={visibleRows}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectAndExpandNode}
            onToggleFolder={toggleFolder}
            onDragStart={() => startDragging('explorer')}
            onDrop={handleExplorerDrop}
            onSwap={swapHorizontalLayout}
          />
        ) : (
          <div className="right-column-container" style={rightColumnStyle}>
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
                      onDragStart={() => startDragging('details')}
                      onDrop={handleDetailsDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div className="resizer horizontal" onMouseDown={handleHeightResize}></div>
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
                      onDragStart={() => startDragging('code')}
                      onDrop={handleCodeDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div className="resizer horizontal" onMouseDown={handleHeightResize}></div>
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
              impactAffectedCount={
                graphMode === 'dependencies' ? (impactSummary?.affectedCount ?? 0) : 0
              }
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
            onDragStart={() => startDragging('explorer')}
            onDrop={handleExplorerDrop}
            onSwap={swapHorizontalLayout}
          />
        ) : (
          <div className="right-column-container" style={rightColumnStyle}>
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
                      onDragStart={() => startDragging('details')}
                      onDrop={handleDetailsDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div className="resizer horizontal" onMouseDown={handleHeightResize}></div>
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
                      onDragStart={() => startDragging('code')}
                      onDrop={handleCodeDrop}
                      onSwapVertical={swapVerticalLayout}
                      onSwapHorizontal={swapHorizontalLayout}
                    />
                    {idx === 0 && (
                      <div className="resizer horizontal" onMouseDown={handleHeightResize}></div>
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
