import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node as FlowNode,
  type Edge as FlowEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import * as d3 from 'd3-hierarchy';
import { StructureTreeNode, type StructureTreeNodeData } from './StructureTreeNode.js';
import type { FileRelationshipIndex } from '../relationshipIndex.js';
import type { ExplorerGraphNode } from '../types.js';

interface VisualTreePanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

const nodeTypes = {
  structure: StructureTreeNode,
};

// D3 Hierarchy interface
interface HierarchyDatum {
  id: string;
  node: ExplorerGraphNode;
  children: HierarchyDatum[];
}

const FullscreenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function VisualTreePanel({
  node,
  index,
  selectedNodeId,
  onSelectNode,
}: VisualTreePanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const { nodes, edges } = useMemo(() => {
    if (!node) {
      return { nodes: [], edges: [] };
    }

    // 1. Build hierarchy tree from selected node downwards
    const buildHierarchy = (currentId: string): HierarchyDatum => {
      const currentNode = index.structureNodeById.get(currentId)!;
      const childrenIds = index.childrenByParentId.get(currentId) || [];
      return {
        id: currentId,
        node: currentNode,
        children: childrenIds.map((child) => buildHierarchy(child.id)),
      };
    };

    const hierarchyData = buildHierarchy(node.id);

    // 2. Compute Layout using D3 Tree
    // nodeSize sets the x and y spacing (width: 240px + gap, height: 60px + vertical gap)
    const treeLayout = d3.tree<HierarchyDatum>().nodeSize([240, 100]);
    const root = d3.hierarchy(hierarchyData);
    treeLayout(root);

    // 3. Convert D3 Tree to React Flow Nodes & Edges
    const flowNodes: FlowNode<StructureTreeNodeData>[] = [];
    const flowEdges: FlowEdge[] = [];

    root.each((d) => {
      flowNodes.push({
        id: d.data.id,
        type: 'structure',
        position: { x: d.x, y: d.y },
        data: {
          node: d.data.node,
          onFocus: (focusId) => {
            onSelectNode(focusId);
            setIsFullscreen(false); // Close fullscreen on focus to show updated tree properly if desired, or keep open. Let's keep it consistent.
          },
        },
      });

      if (d.parent) {
        flowEdges.push({
          id: `${d.parent.data.id}->${d.data.id}`,
          source: d.parent.data.id,
          target: d.data.id,
          type: 'smoothstep', // Clean orthogonal lines like an org chart
          animated: false,
          style: { stroke: '#b7c1cd', strokeWidth: 1.5 },
        });
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [node, index, onSelectNode]);

  const handleFocusClick = (focusId: string) => {
    onSelectNode(focusId);
    if (isFullscreen) {
      // Optional: keep fullscreen open or close it. Let's keep it open for smooth exploration.
    }
  };

  // Re-map nodes to use the latest handleFocusClick
  const latestNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onFocus: handleFocusClick
      }
    }));
  }, [nodes, isFullscreen]);

  if (!node) {
    return (
      <section className="visual-tree-panel empty-state">
        <div className="panel-header">
          <p className="eyebrow">Visual Structure Tree</p>
          <h2>No file or folder selected</h2>
        </div>
        <div className="visual-tree-content empty">
          <p className="empty-copy">Select a folder or file in the project tree to visualize its structure hierarchy.</p>
        </div>
      </section>
    );
  }

  const renderCanvas = () => (
    <ReactFlow
      nodes={latestNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }} // Hide watermark for clean UI
      nodesConnectable={false}
      nodesDraggable={false} // Structure is fixed layout
      elementsSelectable={false}
    >
      <Background color="#f0f3f6" gap={20} />
      <Controls showInteractive={false} />
      <MiniMap 
        nodeColor={(n) => {
          return n.data.node.kind === 'directory' ? '#0f6b59' : '#b7c1cd';
        }} 
        maskColor="rgba(246, 247, 249, 0.7)"
      />
    </ReactFlow>
  );

  return (
    <>
      <section className="visual-tree-panel">
        <div className="panel-header inline">
          <div className="panel-header-title">
            <p className="eyebrow">Visual Structure Tree</p>
            <div className="panel-title-row">
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
        <div className="visual-tree-content">
          {renderCanvas()}
        </div>
      </section>

      {/* Fullscreen Modal Overlay */}
      {isFullscreen && (
        <div className="st-modal-overlay">
          <div className="st-modal-container">
            <div className="st-modal-header">
              <div>
                <p className="eyebrow">Fullscreen Structure Tree</p>
                <h2>{node.label}</h2>
                <span className="st-modal-subpath">{node.relativePath}</span>
              </div>
              <button
                type="button"
                className="st-modal-close"
                onClick={() => setIsFullscreen(false)}
                title="Close Fullscreen (Esc)"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="st-modal-body">
              {renderCanvas()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
