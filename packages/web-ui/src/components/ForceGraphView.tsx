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
  GraphMode,
} from '../types.js';

interface ForceGraphViewProps {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
  selectedNodeId: string | null;
  circularNodeIds: Set<string>;
  orphanNodeIds: Set<string>;
  graphMode: GraphMode;
  labelMode: 'smart' | 'all' | 'none';
  onLabelModeChange: (labelMode: 'smart' | 'all' | 'none') => void;
  onSelectNode: (nodeId: string) => void;
}

interface ForceGraphNode {
  id: string;
  label: string;
  relativePath: string;
  extension: string | null;
  kind: 'file' | 'directory';
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  workspace?: string;
  unusedExportsCount?: number;
  unresolvedImportsCount?: number;
}

interface ForceGraphLink {
  source: string;
  target: string;
  kind: GraphMode;
  importSpecifier?: string;
  circular: boolean;
  typeOnly?: boolean;
  dynamic?: boolean;
  crossPackage?: boolean;
  ruleSeverity?: 'error' | 'warning';
}

interface LabelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const EXTENSION_COLORS = new Map<string, string>([
  ['.ts', '#2563eb'],
  ['.tsx', '#7c3aed'],
  ['.js', '#b58900'],
  ['.jsx', '#c2410c'],
  ['.css', '#15803d'],
  ['.json', '#0f766e'],
]);

const WORKSPACE_COLORS = [
  '#2563eb',
  '#0f766e',
  '#7c3aed',
  '#b45309',
  '#be123c',
  '#047857',
  '#4338ca',
  '#a16207',
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getWorkspaceColor(workspace: string): string {
  return WORKSPACE_COLORS[hashString(workspace) % WORKSPACE_COLORS.length];
}

function getNodeColor(node: ForceGraphNode, selectedNodeId: string | null): string {
  if (node.id === selectedNodeId) {
    return '#0f6b59';
  }

  if (node.isCircular) {
    return '#b33a32';
  }

  if ((node.unresolvedImportsCount ?? 0) > 0) {
    return '#c2410c';
  }

  if (node.isOrphan) {
    return '#9a5b14';
  }

  if ((node.unusedExportsCount ?? 0) > 0) {
    return '#7c3aed';
  }

  if (node.kind === 'directory') {
    return '#647080';
  }

  if (node.workspace) {
    return getWorkspaceColor(node.workspace);
  }

  return EXTENSION_COLORS.get(node.extension ?? '') ?? '#334155';
}

function getNodeRadius(node: ForceGraphNode, selectedNodeId: string | null): number {
  if (node.id === selectedNodeId) {
    return 7;
  }

  if (node.kind === 'directory') {
    return 5;
  }

  return 4;
}

function drawNode(
  node: NodeObject<ForceGraphNode>,
  context: CanvasRenderingContext2D,
  globalScale: number,
  selectedNodeId: string | null,
  occupiedLabelBounds: LabelBounds[],
  labelMode: 'smart' | 'all' | 'none',
) {
  const graphNode = node as NodeObject<ForceGraphNode> & ForceGraphNode;
  const x = graphNode.x ?? 0;
  const y = graphNode.y ?? 0;
  const radius = getNodeRadius(graphNode, selectedNodeId);
  const color = getNodeColor(graphNode, selectedNodeId);

  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI, false);
  context.fillStyle = color;
  context.fill();

  if (graphNode.id === selectedNodeId) {
    context.lineWidth = 2 / globalScale;
    context.strokeStyle = '#063f35';
    context.stroke();
  }

  if (labelMode === 'none' && graphNode.id !== selectedNodeId) {
    return;
  }

  const label = graphNode.label;
  const fontSize = Math.max(9, 11 / globalScale);
  context.font = `${fontSize}px "Avenir Next", "Segoe UI", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'top';

  const paddingX = 3 / globalScale;
  const paddingY = 2 / globalScale;
  const labelY = y + radius + 3 / globalScale;
  const textWidth = context.measureText(label).width;
  const bounds: LabelBounds = {
    left: x - textWidth / 2 - paddingX,
    right: x + textWidth / 2 + paddingX,
    top: labelY - paddingY,
    bottom: labelY + fontSize + paddingY,
  };
  const collides = occupiedLabelBounds.some((existing) => (
    bounds.left < existing.right &&
    bounds.right > existing.left &&
    bounds.top < existing.bottom &&
    bounds.bottom > existing.top
  ));

  const forceShowAllLabels = labelMode === 'all' || globalScale > 2.2;
  if (labelMode === 'smart' && collides && graphNode.id !== selectedNodeId && !forceShowAllLabels) {
    return;
  }

  occupiedLabelBounds.push(bounds);
  context.fillStyle = 'rgba(255, 255, 255, 0.86)';
  context.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  context.fillStyle = '#17202a';
  context.fillText(label, x, labelY);
}

export function ForceGraphView({
  nodes,
  edges,
  selectedNodeId,
  circularNodeIds,
  orphanNodeIds,
  graphMode,
  labelMode,
  onLabelModeChange,
  onSelectNode,
}: ForceGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<ForceGraphNode, ForceGraphLink>>();
  const hasFittedRef = useRef(false);
  const occupiedLabelBoundsRef = useRef<LabelBounds[]>([]);
  const [size, setSize] = useState({ width: 640, height: 420 });

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
      unusedExportsCount: node.unusedExports?.length ?? 0,
      unresolvedImportsCount: node.unresolvedImports?.length ?? 0,
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
  }, [circularNodeIds, edges, nodes, orphanNodeIds]);

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
    if (!selectedGraphNode || typeof selectedGraphNode.x !== 'number' || typeof selectedGraphNode.y !== 'number') {
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
          <p className="eyebrow">{graphMode === 'dependencies' ? 'Dependency Graph' : 'Structure Graph'}</p>
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
          <div className="graph-summary">
            <span>{graphData.links.length.toLocaleString()} edges</span>
            <span>{graphData.nodes.filter((node) => (node.unusedExportsCount ?? 0) > 0).length} unused</span>
            <span>{graphData.nodes.filter((node) => (node.unresolvedImportsCount ?? 0) > 0).length} unresolved</span>
            <span>{graphMode}</span>
          </div>
        </div>
      </div>

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
          linkColor={(link: LinkObject<ForceGraphNode, ForceGraphLink>) => (
            (link as ForceGraphLink).ruleSeverity === 'error'
              ? '#dc2626'
              : (link as ForceGraphLink).ruleSeverity === 'warning'
                ? '#d97706'
                : (link as ForceGraphLink).circular
              ? '#b33a32'
              : (link as ForceGraphLink).crossPackage
                ? '#475569'
                : '#b7c1cd'
          )}
          linkDirectionalArrowColor={(link: LinkObject<ForceGraphNode, ForceGraphLink>) => (
            (link as ForceGraphLink).ruleSeverity === 'error'
              ? '#dc2626'
              : (link as ForceGraphLink).ruleSeverity === 'warning'
                ? '#d97706'
                : (link as ForceGraphLink).circular
                  ? '#b33a32'
                  : '#94a3b8'
          )}
          linkDirectionalArrowLength={graphMode === 'dependencies' ? 5 : 3}
          linkDirectionalArrowRelPos={1}
          linkLineDash={(link: LinkObject<ForceGraphNode, ForceGraphLink>) => (
            (link as ForceGraphLink).crossPackage
              ? [7, 4]
              : (link as ForceGraphLink).typeOnly
                ? [4, 3]
                : null
          )}
          linkWidth={(link: LinkObject<ForceGraphNode, ForceGraphLink>) => (
            (link as ForceGraphLink).ruleSeverity ||
            (link as ForceGraphLink).circular ||
            (link as ForceGraphLink).crossPackage
              ? 2
              : 1
          )}
          nodeCanvasObject={(node, context, globalScale) => {
            drawNode(node, context, globalScale, selectedNodeId, occupiedLabelBoundsRef.current, labelMode);
          }}
          nodeLabel={(node: NodeObject<ForceGraphNode>) => {
            const graphNode = node as ForceGraphNode;
            const details = graphNode.kind === 'file'
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
          onNodeClick={(node: NodeObject<ForceGraphNode>) => {
            if (typeof node.id === 'string') {
              onSelectNode(node.id);
            }
          }}
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
    </section>
  );
}
