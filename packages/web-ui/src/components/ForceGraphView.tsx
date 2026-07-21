import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type GraphData,
  type LinkObject,
  type NodeObject,
} from 'react-force-graph-2d';
import type {
  ExplorerGraphEdge,
  ExplorerGraphNode,
  FileNeighborhoodDepth,
  FolderBoundaryMode,
  GraphMode,
  GraphScopeMode,
} from '../types.js';
import type { DependencyPathResult, GraphBreadcrumb } from '../graphScope.js';
import type { GraphColorMode } from '../graphColors.js';
import { GraphContextBar } from './GraphContextBar.js';
import {
  type ForceGraphLink,
  type ForceGraphNode,
  type LabelBounds,
  type NodeContextMenu,
} from './forceGraphModel.js';
import { drawNode, getLinkColor, getLinkWidth, getNodeRadius } from './forceGraphRendering.js';

interface ForceGraphViewProps {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
  selectedNodeId: string | null;
  circularNodeIds: Set<string>;
  orphanNodeIds: Set<string>;
  impactNodeIds: Set<string>;
  impactEdgeIds: Set<string>;
  impactAffectedCount: number;
  dependencyPathNodeIds: Set<string>;
  dependencyPathEdgeIds: Set<string>;
  dependencyPathTargetId: string | null;
  dependencyPathResult: DependencyPathResult | null;
  dependencyPathLabel: string | null;
  graphMode: GraphMode;
  scopeMode: GraphScopeMode;
  canUseFolderScope: boolean;
  canUseFileScope: boolean;
  neighborhoodDepth: FileNeighborhoodDepth;
  folderBoundaryMode: FolderBoundaryMode;
  breadcrumbs: GraphBreadcrumb[];
  labelMode: 'smart' | 'all' | 'none';
  onLabelModeChange: (labelMode: 'smart' | 'all' | 'none') => void;
  colorMode: GraphColorMode;
  onColorModeChange: (mode: GraphColorMode) => void;
  onScopeModeChange: (mode: GraphScopeMode) => void;
  onNeighborhoodDepthChange: (depth: FileNeighborhoodDepth) => void;
  onFolderBoundaryModeChange: (mode: FolderBoundaryMode) => void;
  onBreadcrumbSelect: (nodeId: string) => void;
  onDependencyPathTargetChange: (nodeId: string | null) => void;
  onOpenNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export function ForceGraphView({
  nodes,
  edges,
  selectedNodeId,
  circularNodeIds,
  orphanNodeIds,
  impactNodeIds,
  impactEdgeIds,
  impactAffectedCount,
  dependencyPathNodeIds,
  dependencyPathEdgeIds,
  dependencyPathTargetId,
  dependencyPathResult,
  dependencyPathLabel,
  graphMode,
  scopeMode,
  canUseFolderScope,
  canUseFileScope,
  neighborhoodDepth,
  folderBoundaryMode,
  breadcrumbs,
  labelMode,
  onLabelModeChange,
  colorMode,
  onColorModeChange,
  onScopeModeChange,
  onNeighborhoodDepthChange,
  onFolderBoundaryModeChange,
  onBreadcrumbSelect,
  onDependencyPathTargetChange,
  onOpenNode,
  onSelectNode,
}: ForceGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<ForceGraphNode, ForceGraphLink>>();
  const hasFittedRef = useRef(false);
  const occupiedLabelBoundsRef = useRef<LabelBounds[]>([]);
  const [size, setSize] = useState({ width: 640, height: 420 });
  const [contextMenu, setContextMenu] = useState<NodeContextMenu | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(260, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo<GraphData<ForceGraphNode, ForceGraphLink>>(() => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const graphNodes: ForceGraphNode[] = nodes.map((node) => ({
      id: node.id,
      label: node.label,
      relativePath: node.relativePath,
      extension: node.extension,
      kind: node.kind,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
      isCircular: circularNodeIds.has(node.id),
      isOrphan: orphanNodeIds.has(node.id),
      workspace: node.workspace,
      complexity: node.metrics?.cyclomaticComplexity ?? 0,
      sizeBytes: node.sizeBytes ?? 0,
      instability: node.metrics?.instability ?? 0,
      unusedExportsCount: node.unusedExports?.length ?? 0,
      unresolvedImportsCount: node.unresolvedImports?.length ?? 0,
      isImpacted: impactNodeIds.has(node.id) && node.id !== selectedNodeId,
      isImpactTarget: impactNodeIds.has(node.id) && node.id === selectedNodeId,
      scopeRole: node.scopeRole,
      memberCount: node.memberCount,
      internalEdgeCount: node.internalEdgeCount,
      isDependencyPath: dependencyPathNodeIds.has(node.id),
      isDependencyPathTarget: dependencyPathTargetId === node.id,
      x:
        node.scopeRole === 'dependent' || node.scopeRole === 'external-incoming'
          ? -140
          : node.scopeRole === 'import' || node.scopeRole === 'external-outgoing'
            ? 140
            : node.scopeRole === 'focus'
              ? 0
              : undefined,
    }));

    const graphLinks: ForceGraphLink[] = edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
        importSpecifier: edge.importSpecifier,
        circular: circularNodeIds.has(edge.source) && circularNodeIds.has(edge.target),
        typeOnly: edge.isTypeOnly,
        dynamic: edge.isDynamic,
        crossPackage: edge.isCrossPackage,
        isImpactPath: impactEdgeIds.has(edge.id),
        isDependencyPath:
          dependencyPathEdgeIds.has(edge.id) ||
          (edge.memberEdgeIds ?? []).some((id) => dependencyPathEdgeIds.has(id)),
        scopeRole: edge.scopeRole,
        aggregateCount: edge.aggregateCount,
        memberEdgeIds: edge.memberEdgeIds,
        ruleSeverity: edge.ruleViolations?.some((violation) => violation.severity === 'error')
          ? 'error'
          : edge.ruleViolations?.length
            ? 'warning'
            : undefined,
      }));

    return {
      nodes: graphNodes,
      links: graphLinks,
    };
  }, [
    circularNodeIds,
    dependencyPathEdgeIds,
    dependencyPathNodeIds,
    dependencyPathTargetId,
    edges,
    impactEdgeIds,
    impactNodeIds,
    nodes,
    orphanNodeIds,
    selectedNodeId,
  ]);
  const maxComplexity = useMemo(
    () => Math.max(1, ...graphData.nodes.map((node) => node.complexity ?? 0)),
    [graphData.nodes],
  );
  const maxSize = useMemo(
    () => Math.max(1, ...graphData.nodes.map((node) => node.sizeBytes ?? 0)),
    [graphData.nodes],
  );

  function fitGraph(durationMs = 350) {
    graphRef.current?.zoomToFit(durationMs, 36);
    hasFittedRef.current = true;
  }

  useEffect(() => {
    hasFittedRef.current = false;
    const timeoutId = window.setTimeout(() => {
      if (!hasFittedRef.current) {
        fitGraph();
      }
    }, 450);
    return () => window.clearTimeout(timeoutId);
  }, [graphData, size.height, size.width]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const selectedGraphNode = graphData.nodes.find((node) => node.id === selectedNodeId);
    if (
      !selectedGraphNode ||
      typeof selectedGraphNode.x !== 'number' ||
      typeof selectedGraphNode.y !== 'number'
    ) {
      return;
    }

    graphRef.current?.centerAt(selectedGraphNode.x, selectedGraphNode.y, 450);
  }, [graphData.nodes, selectedNodeId]);

  if (!nodes.length) {
    return (
      <section className="force-graph-panel empty-state">
        <div className="panel-header">
          <p className="eyebrow">Graph View</p>
          <h2>No visible nodes</h2>
        </div>
        <p className="empty-copy">Adjust the search or filters to show graph nodes.</p>
      </section>
    );
  }

  return (
    <section className="force-graph-panel">
      <div className="panel-header inline">
        <div>
          <p className="eyebrow">
            {graphMode === 'dependencies' ? 'Dependency Graph' : 'Structure Graph'}
          </p>
          <h2>{nodes.length.toLocaleString()} nodes</h2>
        </div>
        <div className="graph-header-actions">
          <label className="graph-label-select" title="Control graph node label visibility">
            <span>Labels</span>
            <select
              value={labelMode}
              onChange={(event) => {
                onLabelModeChange(event.target.value as 'smart' | 'all' | 'none');
              }}
            >
              <option value="smart">Smart</option>
              <option value="all">All</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="graph-label-select" title="Color graph nodes by metric">
            <span>Color</span>
            <select
              value={colorMode}
              onChange={(event) => {
                onColorModeChange(event.target.value as GraphColorMode);
              }}
            >
              <option value="extension">Extension</option>
              <option value="complexity">Complexity</option>
              <option value="size">File Size</option>
              <option value="instability">Instability</option>
            </select>
          </label>
          <div className="graph-summary">
            <span>{graphData.links.length.toLocaleString()} edges</span>
            {impactAffectedCount > 0 ? (
              <span>{impactAffectedCount.toLocaleString()} impact</span>
            ) : null}
            <span>
              {graphData.nodes.filter((node) => (node.unusedExportsCount ?? 0) > 0).length} unused
            </span>
            <span>
              {graphData.nodes.filter((node) => (node.unresolvedImportsCount ?? 0) > 0).length}{' '}
              unresolved
            </span>
            <span>{graphMode}</span>
          </div>
        </div>
      </div>

      <GraphContextBar
        scopeMode={scopeMode}
        canUseFolderScope={canUseFolderScope}
        canUseFileScope={canUseFileScope}
        neighborhoodDepth={neighborhoodDepth}
        folderBoundaryMode={folderBoundaryMode}
        breadcrumbs={breadcrumbs}
        pathResult={dependencyPathResult}
        pathLabel={dependencyPathLabel}
        onScopeModeChange={onScopeModeChange}
        onNeighborhoodDepthChange={onNeighborhoodDepthChange}
        onFolderBoundaryModeChange={onFolderBoundaryModeChange}
        onBreadcrumbSelect={onBreadcrumbSelect}
        onClearPath={() => onDependencyPathTargetChange(null)}
      />

      <div className="force-graph-canvas" ref={containerRef}>
        <ForceGraph2D<ForceGraphNode, ForceGraphLink>
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="#ffffff"
          cooldownTicks={nodes.length > 1000 ? 100 : 80}
          enablePanInteraction
          enableNodeDrag
          enablePointerInteraction
          enableZoomInteraction
          linkColor={(link: LinkObject<ForceGraphNode, ForceGraphLink>) =>
            getLinkColor(link as ForceGraphLink)
          }
          linkDirectionalArrowColor={(link: LinkObject<ForceGraphNode, ForceGraphLink>) =>
            getLinkColor(link as ForceGraphLink)
          }
          linkDirectionalArrowLength={(link: LinkObject<ForceGraphNode, ForceGraphLink>) =>
            (link as ForceGraphLink).scopeRole === 'membership'
              ? 0
              : graphMode === 'dependencies'
                ? 5
                : 3
          }
          linkDirectionalArrowRelPos={1}
          linkLineDash={(link: LinkObject<ForceGraphNode, ForceGraphLink>) =>
            (link as ForceGraphLink).scopeRole === 'membership'
              ? [2, 4]
              : (link as ForceGraphLink).crossPackage
                ? [7, 4]
                : (link as ForceGraphLink).typeOnly
                  ? [4, 3]
                  : null
          }
          linkWidth={(link: LinkObject<ForceGraphNode, ForceGraphLink>) =>
            getLinkWidth(link as ForceGraphLink)
          }
          linkLabel={(link: LinkObject<ForceGraphNode, ForceGraphLink>) => {
            const graphLink = link as ForceGraphLink;
            if (graphLink.scopeRole === 'membership') {
              return `${graphLink.aggregateCount ?? 1} file(s) in group`;
            }
            const count = graphLink.aggregateCount ?? 1;
            return count > 1
              ? `${count} aggregated dependencies`
              : (graphLink.importSpecifier ?? 'dependency');
          }}
          nodeCanvasObject={(node, context, globalScale) => {
            drawNode(
              node,
              context,
              globalScale,
              selectedNodeId,
              occupiedLabelBoundsRef.current,
              labelMode,
              colorMode,
              maxComplexity,
              maxSize,
            );
          }}
          nodeLabel={(node: NodeObject<ForceGraphNode>) => {
            const graphNode = node as ForceGraphNode;
            const details =
              graphNode.kind === 'file'
                ? `in ${graphNode.inDegree ?? 0} / out ${graphNode.outDegree ?? 0}`
                : 'directory';
            const workspace = graphNode.workspace ? ` - ${graphNode.workspace}` : '';
            const issues: string[] = [];
            if ((graphNode.unusedExportsCount ?? 0) > 0) {
              issues.push(`${graphNode.unusedExportsCount} unused export(s)`);
            }
            if ((graphNode.unresolvedImportsCount ?? 0) > 0) {
              issues.push(`${graphNode.unresolvedImportsCount} unresolved import(s)`);
            }
            if (graphNode.isImpacted) {
              issues.push('impacted by selected file');
            }
            return `${graphNode.relativePath}${workspace} - ${details}${issues.length > 0 ? ` - ${issues.join(', ')}` : ''}`;
          }}
          nodePointerAreaPaint={(node, color, context) => {
            const graphNode = node as NodeObject<ForceGraphNode> & ForceGraphNode;
            const radius = getNodeRadius(graphNode, selectedNodeId) + 4;
            context.fillStyle = color;
            context.beginPath();
            context.arc(graphNode.x ?? 0, graphNode.y ?? 0, radius, 0, 2 * Math.PI, false);
            context.fill();
          }}
          onNodeClick={(node: NodeObject<ForceGraphNode>, event: MouseEvent) => {
            if (typeof node.id !== 'string') {
              return;
            }
            const graphNode = node as ForceGraphNode;
            if (
              event.detail > 1 ||
              graphNode.kind === 'directory' ||
              !canUseFileScope ||
              node.id === selectedNodeId
            ) {
              onSelectNode(node.id);
            } else {
              onDependencyPathTargetChange(node.id);
            }
          }}
          onNodeRightClick={(node: NodeObject<ForceGraphNode>, event: MouseEvent) => {
            event.preventDefault();
            setContextMenu({
              node: node as ForceGraphNode,
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onBackgroundClick={() => setContextMenu(null)}
          onEngineStop={() => {
            if (!hasFittedRef.current) {
              fitGraph(250);
            }
          }}
          onRenderFramePre={() => {
            occupiedLabelBoundsRef.current = [];
          }}
          showPointerCursor
        />
      </div>

      {contextMenu ? (
        <div
          className="graph-context-menu"
          onClick={(event) => event.stopPropagation()}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.kind === 'file' ? (
            <button
              onClick={() => {
                onOpenNode(contextMenu.node.id);
                setContextMenu(null);
              }}
              type="button"
            >
              Open source
            </button>
          ) : null}
          <button
            onClick={() => {
              onSelectNode(contextMenu.node.id);
              setContextMenu(null);
            }}
            type="button"
          >
            {contextMenu.node.kind === 'directory' ? 'Drill into folder' : 'Focus neighborhood'}
          </button>
          {canUseFileScope &&
          contextMenu.node.kind === 'file' &&
          contextMenu.node.id !== selectedNodeId ? (
            <button
              onClick={() => {
                onDependencyPathTargetChange(contextMenu.node.id);
                setContextMenu(null);
              }}
              type="button"
            >
              Show dependency path
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
