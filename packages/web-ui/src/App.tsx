import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
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

const DEFAULT_DEPENDENCY_FILTERS: DependencyFilters = {
  showTypeOnlyEdges: true,
  showDynamicEdges: true,
  circularOnly: false,
};

function readInitialMode(): GraphMode {
  const searchParams = new URLSearchParams(window.location.search);
  const queryMode = searchParams.get('mode');
  const embeddedMode = window.__RDG_INITIAL_MODE__;
  const rawMode = queryMode ?? embeddedMode ?? 'structure';

  return rawMode === 'dependencies' ? 'dependencies' : 'structure';
}

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
  const availableModes = dataSet?.availableModes ?? ['structure'];
  const [activeMode, setActiveMode] = useState<GraphMode>(() => readInitialMode());
  const [searchTerm, setSearchTerm] = useState('');
  const [dependencyFilters, setDependencyFilters] = useState<DependencyFilters>(DEFAULT_DEPENDENCY_FILTERS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [millerChain, setMillerChain] = useState<string[]>([]);
  const [activeCodeNodeId, setActiveCodeNodeId] = useState<string | null>(null);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const resolvedMode = availableModes.includes(activeMode) ? activeMode : (dataSet?.defaultMode ?? 'structure');
  const selectedNode = selectedNodeId ? (index.nodeById.get(selectedNodeId) ?? null) : null;
  const activeCodeNode = activeCodeNodeId ? (index.nodeById.get(activeCodeNodeId) ?? null) : null;

  const folderSummary = activeCodeNode?.kind === 'directory'
    ? getFolderSummary(activeCodeNode.id, index, dependencyFilters)
    : null;
  const visibleRows = useMemo(() => (
    buildTreeRows(index, expandedIds, deferredSearchTerm, dependencyFilters)
  ), [deferredSearchTerm, dependencyFilters, expandedIds, index]);

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
    if (availableModes.includes(activeMode)) {
      return;
    }

    setActiveMode(dataSet?.defaultMode ?? 'structure');
  }, [activeMode, availableModes, dataSet?.defaultMode]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('mode', resolvedMode);
    window.history.replaceState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
  }, [resolvedMode]);

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
        availableModes={availableModes}
        activeMode={resolvedMode}
        sourceLabel={SOURCE_LABELS[source]}
        searchTerm={searchTerm}
        totalFiles={index.structureGraph?.totalFiles ?? index.dependencyGraph?.totalFiles ?? 0}
        totalDirs={index.structureGraph?.totalDirs ?? 0}
        totalImports={index.dependencyGraph?.totalImports ?? 0}
        circularCount={index.dependencyGraph?.circularCount ?? index.circularNodeIds.size}
        visibleRows={visibleRows.length}
        dependencyFilters={dependencyFilters}
        onModeChange={(nextMode) => {
          startTransition(() => setActiveMode(nextMode));
        }}
        onSearchChange={(nextSearch) => {
          startTransition(() => setSearchTerm(nextSearch));
        }}
        onDependencyFiltersChange={(nextFilters) => {
          startTransition(() => setDependencyFilters(nextFilters));
        }}
      />

      <div className="explorer-grid">
        <FileTreeView
          rows={visibleRows}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onToggleFolder={toggleFolder}
        />

        <div className="center-column">
          <MillerColumnsPanel
            node={selectedNode}
            index={index}
            chain={millerChain}
            onChainChange={setMillerChain}
            onActiveNodeChange={setActiveCodeNodeId}
          />
        </div>

        <div className="right-column">
          <SelectionPanel
            node={activeCodeNode}
            index={index}
            folderSummary={folderSummary}
            projectRoot={index.projectRoot}
            error={error}
          />
          <FileCodeViewer
            node={activeCodeNode}
            index={index}
            onSelectNode={setSelectedNodeId}
            eligibleTabs={millerChain}
            activeTabId={activeCodeNodeId}
            onTabSelect={setActiveCodeNodeId}
          />
        </div>
      </div>
    </main>
  );
}
