import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  type ReactFlowInstance,
  type Edge,
  type Node,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { CircleNode } from './CircleNode.js';
import type { StructureGraphEdge, StructureGraphNode } from '../types.js';

const NODE_TYPES = {
  circle: CircleNode,
};

function layoutGraph(nodes: StructureGraphNode[], edges: StructureGraphEdge[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'TB',
    ranksep: 92,
    nodesep: 40,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const size = node.kind === 'directory'
      ? Math.min(110, 76 + node.descendantCount * 2)
      : 58;
    graph.setNode(node.id, { width: size, height: size });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return { graph };
}

interface GraphViewProps {
  nodes: StructureGraphNode[];
  edges: StructureGraphEdge[];
  matchedNodeIds: Set<string>;
  emphasizedNodeIds: Set<string>;
  selectedNodeId: string | null;
  fitViewNonce: number;
  onSelectNode: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
}

export function GraphView({
  nodes,
  edges,
  matchedNodeIds,
  emphasizedNodeIds,
  selectedNodeId,
  fitViewNonce,
  onSelectNode,
  onToggleNode,
}: GraphViewProps) {
  const { graph } = layoutGraph(nodes, edges);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (!flowInstance) {
      return;
    }

    void flowInstance.fitView({
      padding: 0.2,
      duration: 280,
    });
  }, [fitViewNonce, flowInstance]);

  const flowNodes: Node[] = nodes.map((node) => {
    const position = graph.node(node.id);
    const size = node.kind === 'directory'
      ? Math.min(110, 76 + node.descendantCount * 2)
      : 58;
    const matched = matchedNodeIds.has(node.id);
    const emphasized = emphasizedNodeIds.has(node.id);
    return {
      id: node.id,
      type: 'circle',
      position: {
        x: position.x - size / 2,
        y: position.y - size / 2,
      },
      data: {
        node,
        selected: node.id === selectedNodeId,
        matched,
        emphasized,
        dimmed: matchedNodeIds.size > 0 && !emphasized,
        onToggle: onToggleNode,
      },
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => {
    const emphasized = emphasizedNodeIds.has(edge.source)
      && emphasizedNodeIds.has(edge.target);
    const stroke = emphasized ? '#26445e' : '#6f7f90';

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: stroke,
      },
      style: {
        stroke,
        strokeWidth: emphasized ? 1.8 : 1.35,
        opacity: matchedNodeIds.size > 0 && !emphasized ? 0.18 : 0.7,
      },
    };
  });

  return (
    <div className="graph-shell">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        onInit={setFlowInstance}
        onNodeClick={(_, node) => onSelectNode(node.id)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          size={1}
          gap={28}
          color="#8ea0ad44"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (
            node.id === selectedNodeId
              ? '#13293d'
              : matchedNodeIds.size > 0 && !emphasizedNodeIds.has(node.id)
                ? '#c5ced3'
                : matchedNodeIds.has(node.id)
                  ? '#ef8a16'
                  : '#3d8bfd'
          )}
          maskColor="rgba(250, 244, 233, 0.62)"
        />
      </ReactFlow>
    </div>
  );
}
