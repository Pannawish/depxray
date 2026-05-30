import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { GraphView } from './components/GraphView.js';
import { SidePanel } from './components/SidePanel.js';
import { Toolbar } from './components/Toolbar.js';
import { useGraphData } from './hooks/useGraphData.js';
import { useTreeState } from './hooks/useTreeState.js';
import type { DepthFilter } from './types.js';

const SOURCE_LABELS = {
  window: 'embedded data',
  http: 'live server',
  sample: 'sample preview',
} as const;

export default function App() {
  const { data, loading, error, source } = useGraphData();
  const [depthFilter, setDepthFilter] = useState<DepthFilter>(2);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const {
    visibleNodes,
    visibleEdges,
    matchedNodeIds,
    toggleCollapsed,
  } = useTreeState(data, depthFilter, deferredSearchTerm);

  useEffect(() => {
    if (!visibleNodes.length) {
      setSelectedNodeId(null);
      return;
    }

    const selectedStillVisible = visibleNodes.some((node) => node.id === selectedNodeId);
    if (!selectedStillVisible) {
      setSelectedNodeId(visibleNodes[0]?.id ?? null);
    }
  }, [selectedNodeId, visibleNodes]);

  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId) ?? null;

  if (loading) {
    return (
      <main className="app-shell loading-state">
        <div className="loading-card">
          <p className="eyebrow">Preparing graph</p>
          <h1>Scanning project structure…</h1>
          <p className="muted">Waiting for graph data from the CLI or embedded payload.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="app-frame">
        <Toolbar
          totalFiles={data?.totalFiles ?? 0}
          totalDirs={data?.totalDirs ?? 0}
          sourceLabel={SOURCE_LABELS[source]}
          depthFilter={depthFilter}
          searchTerm={searchTerm}
          onDepthChange={(nextDepth) => {
            startTransition(() => setDepthFilter(nextDepth));
          }}
          onSearchChange={(nextSearch) => {
            startTransition(() => setSearchTerm(nextSearch));
          }}
        />

        <div className="content-grid">
          <section className="graph-panel">
            <div className="graph-header">
              <div>
                <p className="eyebrow">Project root</p>
                <h2>{data?.projectRoot}</h2>
              </div>
              <p className="muted">
                {visibleNodes.length} visible nodes
                {' · '}
                {visibleEdges.length} visible edges
              </p>
            </div>

            <GraphView
              nodes={visibleNodes}
              edges={visibleEdges}
              matchedNodeIds={matchedNodeIds}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onToggleNode={toggleCollapsed}
            />
          </section>

          <SidePanel
            node={selectedNode}
            projectRoot={data?.projectRoot ?? ''}
            error={error}
          />
        </div>
      </section>
    </main>
  );
}
