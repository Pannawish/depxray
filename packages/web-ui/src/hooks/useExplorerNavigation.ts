import { useEffect, useMemo, useState } from 'react';
import {
  buildInitialExpandedIds,
  buildTreeRows,
  firstSelectableNode,
  scopeModeForNode,
} from '../explorerViewModel.js';
import { getAncestorIds, type FileRelationshipIndex } from '../relationshipIndex.js';
import type { DependencyFilters, GraphScopeMode } from '../types.js';

export function useExplorerNavigation(
  index: FileRelationshipIndex,
  searchTerm: string,
  filters: DependencyFilters,
  clearSearch: () => void,
) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [millerChain, setMillerChain] = useState<string[]>([]);
  const [activeCodeNodeId, setActiveCodeNodeId] = useState<string | null>(null);
  const [graphScopeMode, setGraphScopeMode] = useState<GraphScopeMode>('project');
  const [dependencyPathTargetId, setDependencyPathTargetId] = useState<string | null>(null);
  const visibleRows = useMemo(
    () => buildTreeRows(index, expandedIds, searchTerm, filters),
    [expandedIds, filters, index, searchTerm],
  );
  const selectedNode = selectedNodeId ? (index.nodeById.get(selectedNodeId) ?? null) : null;
  const activeCodeNode = activeCodeNodeId ? (index.nodeById.get(activeCodeNodeId) ?? null) : null;

  useEffect(() => {
    setMillerChain(selectedNodeId ? [selectedNodeId] : []);
    setActiveCodeNodeId(selectedNodeId);
  }, [selectedNodeId]);

  useEffect(() => {
    setExpandedIds(buildInitialExpandedIds(index));
    setSelectedNodeId(firstSelectableNode(index)?.id ?? null);
    setGraphScopeMode('project');
    setDependencyPathTargetId(null);
  }, [index]);

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedNodeId(null);
    } else if (!selectedNodeId || !visibleRows.some((row) => row.node.id === selectedNodeId)) {
      const nextNode = visibleRows[0]?.node ?? null;
      setSelectedNodeId(nextNode?.id ?? null);
      setGraphScopeMode(scopeModeForNode(nextNode, index));
      setDependencyPathTargetId(null);
    }
  }, [index, selectedNodeId, visibleRows]);

  function selectNode(nodeId: string): void {
    clearSearch();
    setExpandedIds((current) => new Set([...current, ...getAncestorIds(nodeId, index)]));
    setSelectedNodeId(nodeId);
    setDependencyPathTargetId(null);
    setGraphScopeMode(scopeModeForNode(index.nodeById.get(nodeId), index));
  }

  function openNode(nodeId: string): void {
    const node = index.nodeById.get(nodeId);
    if (node?.kind !== 'file') return;
    setMillerChain((current) => (current.includes(nodeId) ? current : [...current, nodeId]));
    setActiveCodeNodeId(nodeId);
  }

  function toggleFolder(nodeId: string): void {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  return {
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
    selectNode,
    openNode,
    toggleFolder,
  };
}
