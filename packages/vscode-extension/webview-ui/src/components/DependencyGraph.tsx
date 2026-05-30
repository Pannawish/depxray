// ============================================================================
// DependencyGraph — Interactive React Flow graph with dagre auto-layout
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import type { ScanResult, GraphNode, GraphEdge } from '../hooks/useVSCodeAPI.js';

// ── Node dimensions for dagre layout ────────────────────────────────────────
const NODE_WIDTH = 200;
const NODE_HEIGHT = 40;

// ── Color by file extension ─────────────────────────────────────────────────
function getNodeColor(extension: string, isCircular: boolean): string {
  if (isCircular) return '#FF5555';
  switch (extension) {
    case '.tsx': return '#1a6a8a'; // React blue (darker for contrast)
    case '.ts':  return '#1a4a7a'; // TypeScript blue
    case '.jsx': return '#7a6a1a'; // JS yellow-ish
    case '.js':  return '#6a5a1a';
    default:     return '#3a3a3a';
  }
}

function getNodeBorderColor(extension: string, isCircular: boolean): string {
  if (isCircular) return '#FF5555';
  switch (extension) {
    case '.tsx': return '#61DAFB';
    case '.ts':  return '#3178C6';
    case '.jsx': return '#F7DF1E';
    case '.js':  return '#F7DF1E';
    default:     return '#666';
  }
}

// ── Convert scan result → React Flow nodes & edges ──────────────────────────
function toFlowElements(
  scanResult: ScanResult,
  layoutDir: 'LR' | 'TB',
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: layoutDir, nodesep: 30, ranksep: 60 });

  // Register all nodes with dagre
  for (const node of scanResult.graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Register edges with dagre
  for (const edge of scanResult.graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run the layout
  dagre.layout(g);

  // Build React Flow nodes
  const rfNodes: Node[] = scanResult.graph.nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const label = node.relativePath.length > 35
      ? '…' + node.relativePath.slice(-33)
      : node.relativePath;

    return {
      id: node.id,
      type: 'default',
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      },
      data: {
        label: (
          <div title={node.relativePath} style={{ fontSize: 11, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </div>
            <div style={{ opacity: 0.7, fontSize: 10 }}>
              ↑{node.inDegree} →{node.outDegree}
              {node.isCircular && ' 🔴'}
            </div>
          </div>
        ),
        absolutePath: node.id,
      },
      style: {
        background: getNodeColor(node.extension, node.isCircular),
        border: `1.5px solid ${getNodeBorderColor(node.extension, node.isCircular)}`,
        borderRadius: 6,
        color: '#fff',
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        fontSize: 12,
        cursor: 'pointer',
      },
    };
  });

  // Build React Flow edges
  const rfEdges: Edge[] = scanResult.graph.edges.map((edge, i) => ({
    id: `${edge.source}->${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: edge.isDynamic,
    style: {
      stroke: edge.isTypeOnly ? '#555577' : edge.isDynamic ? '#FFaa00' : '#4a4a6a',
      strokeWidth: 1.5,
      strokeDasharray: edge.isTypeOnly ? '4 3' : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.isTypeOnly ? '#555577' : '#4a4a6a',
      width: 16,
      height: 16,
    },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Component ────────────────────────────────────────────────────────────────

interface DependencyGraphProps {
  scanResult: ScanResult;
  layout: 'LR' | 'TB';
  isDark: boolean;
  onNodeClick: (absolutePath: string) => void;
}

export function DependencyGraph({
  scanResult,
  layout,
  isDark,
  onNodeClick,
}: DependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => toFlowElements(scanResult, layout),
    [scanResult, layout],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-layout when data or direction changes
  useEffect(() => {
    const { nodes: n, edges: e } = toFlowElements(scanResult, layout);
    setNodes(n);
    setEdges(e);
  }, [scanResult, layout, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.data?.absolutePath) {
        onNodeClick(node.data.absolutePath);
      }
    },
    [onNodeClick],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.05}
      maxZoom={3}
      attributionPosition="bottom-right"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color={isDark ? '#333' : '#ddd'}
      />
      <Controls
        style={{
          background: 'var(--vscode-sideBar-background, #252526)',
          border: '1px solid var(--vscode-panel-border, #444)',
          borderRadius: 6,
        }}
      />
      <MiniMap
        nodeColor={(node) => {
          const n = scanResult.graph.nodes.find((gn) => gn.id === node.id);
          return n ? getNodeColor(n.extension, n.isCircular) : '#3a3a3a';
        }}
        style={{
          background: 'var(--vscode-sideBar-background, #252526)',
          border: '1px solid var(--vscode-panel-border, #444)',
          borderRadius: 6,
        }}
        maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
      />
    </ReactFlow>
  );
}
