import type { NodeObject } from 'react-force-graph-2d';
import { interpolateHeatColor, type GraphColorMode } from '../graphColors.js';
import type { ForceGraphLink, ForceGraphNode, LabelBounds } from './forceGraphModel.js';

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

function nodeStatusColor(node: ForceGraphNode, selectedNodeId: string | null): string {
  if (node.id === selectedNodeId) return '#0f6b59';
  if (node.scopeRole === 'dependent' || node.scopeRole === 'external-incoming') return '#2563eb';
  if (node.scopeRole === 'import' || node.scopeRole === 'external-outgoing') return '#c2410c';
  if (node.scopeRole === 'related' || node.scopeRole === 'external-both') return '#7c3aed';
  if (node.scopeRole === 'internal') return node.kind === 'directory' ? '#475569' : '#0f766e';
  if (node.isCircular) return '#b33a32';
  if ((node.unresolvedImportsCount ?? 0) > 0) return '#c2410c';
  if (node.isOrphan) return '#9a5b14';
  if ((node.unusedExportsCount ?? 0) > 0) return '#7c3aed';
  if (node.kind === 'directory') return '#647080';
  if (node.workspace) return WORKSPACE_COLORS[hashString(node.workspace) % WORKSPACE_COLORS.length];
  return EXTENSION_COLORS.get(node.extension ?? '') ?? '#334155';
}

function nodeColor(
  node: ForceGraphNode,
  selectedNodeId: string | null,
  colorMode: GraphColorMode,
  maxComplexity: number,
  maxSize: number,
): string {
  if (node.id === selectedNodeId) return '#0f6b59';
  if (colorMode === 'complexity') return interpolateHeatColor(node.complexity ?? 0, maxComplexity);
  if (colorMode === 'size') return interpolateHeatColor(node.sizeBytes ?? 0, maxSize);
  if (colorMode === 'instability') return interpolateHeatColor(node.instability ?? 0, 1);
  return nodeStatusColor(node, selectedNodeId);
}

export function getNodeRadius(node: ForceGraphNode, selectedNodeId: string | null): number {
  if (node.id === selectedNodeId) return 7;
  if (node.kind === 'directory') return 5 + Math.min(5, Math.sqrt(node.memberCount ?? 1));
  return 4;
}

export function getLinkEndpointId(endpoint: unknown): string | null {
  if (typeof endpoint === 'string') return endpoint;
  if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
    return typeof endpoint.id === 'string' ? endpoint.id : null;
  }
  return null;
}

export function isLinkIncident(link: ForceGraphLink, nodeId: string | null): boolean {
  return Boolean(
    nodeId &&
      (getLinkEndpointId(link.source) === nodeId || getLinkEndpointId(link.target) === nodeId),
  );
}

export function getLinkColor(link: ForceGraphLink, activeNodeId: string | null = null): string {
  if (link.isDependencyPath || link.isImpactPath) return '#0891b2';
  if (activeNodeId && !isLinkIncident(link, activeNodeId)) return 'rgba(148, 163, 184, 0.12)';
  if (link.scopeRole === 'membership') return '#cbd5e1';
  if (link.scopeRole === 'incoming') return '#2563eb';
  if (link.scopeRole === 'outgoing') return '#c2410c';
  if (link.ruleSeverity === 'error') return '#dc2626';
  if (link.ruleSeverity === 'warning') return '#d97706';
  if (link.circular) return '#b33a32';
  if (link.crossPackage) return '#475569';
  return '#b7c1cd';
}

export function getLinkWidth(link: ForceGraphLink, activeNodeId: string | null = null): number {
  if (link.isDependencyPath) return 3;
  if (activeNodeId && !isLinkIncident(link, activeNodeId)) return 0.5;
  if ((link.aggregateCount ?? 1) > 1) return Math.min(6, 1 + Math.log2(link.aggregateCount ?? 1));
  return link.ruleSeverity || link.isImpactPath || link.circular || link.crossPackage ? 2 : 1;
}

export function getSemanticLabelSize(globalScale: number, selected: boolean): number {
  const screenPixels = globalScale < 0.75 ? 12 : globalScale < 1.75 ? 10.5 : 8.5;
  return (selected ? Math.max(11, screenPixels) : screenPixels) / Math.max(globalScale, 0.1);
}

export function shouldShowSemanticLabel(
  node: ForceGraphNode,
  globalScale: number,
  selectedNodeId: string | null,
  activeNodeId: string | null,
  labelMode: 'smart' | 'all' | 'none',
): boolean {
  const emphasized = node.id === selectedNodeId || node.id === activeNodeId;
  if (emphasized) return true;
  if (labelMode === 'none') return false;
  if (labelMode === 'all') return true;
  if (globalScale < 0.75) return node.kind === 'directory' || Boolean(node.isHub);
  return true;
}

export function drawNode(
  node: NodeObject<ForceGraphNode>,
  context: CanvasRenderingContext2D,
  globalScale: number,
  selectedNodeId: string | null,
  occupiedLabelBounds: LabelBounds[],
  labelMode: 'smart' | 'all' | 'none',
  colorMode: GraphColorMode,
  maxComplexity: number,
  maxSize: number,
  activeNodeId: string | null = null,
  connectedNodeIds: Set<string> = new Set(),
): void {
  const graphNode = node as NodeObject<ForceGraphNode> & ForceGraphNode;
  const x = graphNode.x ?? 0;
  const y = graphNode.y ?? 0;
  const radius = getNodeRadius(graphNode, selectedNodeId);
  const color = nodeColor(graphNode, selectedNodeId, colorMode, maxComplexity, maxSize);

  const dimmed = Boolean(
    activeNodeId && graphNode.id !== activeNodeId && !connectedNodeIds.has(graphNode.id),
  );
  context.save();
  if (dimmed) context.globalAlpha = 0.22;
  context.beginPath();
  if (graphNode.kind === 'directory') context.rect(x - radius, y - radius, radius * 2, radius * 2);
  else context.arc(x, y, radius, 0, 2 * Math.PI, false);
  context.fillStyle = color;
  context.fill();

  const rings = [
    graphNode.isDependencyPath || graphNode.isDependencyPathTarget
      ? {
          width: graphNode.isDependencyPathTarget ? 3 : 2,
          color: graphNode.isDependencyPathTarget ? '#7c3aed' : '#0891b2',
          offset: 6,
        }
      : null,
    graphNode.isImpacted || graphNode.isImpactTarget
      ? {
          width: graphNode.isImpactTarget ? 2.5 : 2,
          color: graphNode.isImpactTarget ? '#0f6b59' : '#0891b2',
          offset: 4,
        }
      : null,
  ];
  for (const ring of rings) {
    if (!ring) continue;
    context.lineWidth = ring.width / globalScale;
    context.strokeStyle = ring.color;
    context.beginPath();
    context.arc(x, y, radius + ring.offset / globalScale, 0, 2 * Math.PI, false);
    context.stroke();
  }

  if (graphNode.id === selectedNodeId) {
    context.lineWidth = 2 / globalScale;
    context.strokeStyle = '#063f35';
    context.beginPath();
    if (graphNode.kind === 'directory')
      context.rect(x - radius, y - radius, radius * 2, radius * 2);
    else context.arc(x, y, radius, 0, 2 * Math.PI, false);
    context.stroke();
  }
  if (!shouldShowSemanticLabel(graphNode, globalScale, selectedNodeId, activeNodeId, labelMode)) {
    context.restore();
    return;
  }

  const fontSize = getSemanticLabelSize(globalScale, graphNode.id === selectedNodeId);
  context.font = `${fontSize}px "Avenir Next", "Segoe UI", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  const labelY = y + radius + 3 / globalScale;
  const textWidth = context.measureText(graphNode.label).width;
  const paddingX = 3 / globalScale;
  const paddingY = 2 / globalScale;
  const bounds: LabelBounds = {
    left: x - textWidth / 2 - paddingX,
    right: x + textWidth / 2 + paddingX,
    top: labelY - paddingY,
    bottom: labelY + fontSize + paddingY,
  };
  const collides = occupiedLabelBounds.some(
    (existing) =>
      bounds.left < existing.right &&
      bounds.right > existing.left &&
      bounds.top < existing.bottom &&
      bounds.bottom > existing.top,
  );
  if (labelMode === 'smart' && collides && graphNode.id !== selectedNodeId && globalScale <= 2.2) {
    context.restore();
    return;
  }

  occupiedLabelBounds.push(bounds);
  context.fillStyle = 'rgba(255, 255, 255, 0.86)';
  context.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  context.fillStyle = '#17202a';
  context.fillText(graphNode.label, x, labelY);
  context.restore();
}
