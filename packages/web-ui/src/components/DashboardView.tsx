import type { FileRelationshipIndex } from '../relationshipIndex.js';
import type { ExplorerGraphData } from '../types.js';

interface DashboardViewProps {
  index: FileRelationshipIndex;
  healthScore: ExplorerGraphData['healthScore'] | undefined;
  onSelectNode: (nodeId: string) => void;
}

const GRADE_COLORS = {
  A: '#15803d',
  B: '#2563eb',
  C: '#b45309',
  D: '#c2410c',
  F: '#b33a32',
} as const;

function ChartRow({
  label,
  value,
  max,
  onSelect,
}: {
  label: string;
  value: number;
  max: number;
  onSelect: () => void;
}) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const separatorIndex = label.lastIndexOf('/');
  const fileName = separatorIndex >= 0 ? label.slice(separatorIndex + 1) : label;
  const parentPath = separatorIndex >= 0 ? label.slice(0, separatorIndex) : '';

  return (
    <button className="dashboard-chart-row" onClick={onSelect} title={label} type="button">
      <span className="dashboard-chart-label">
        <strong>{fileName}</strong>
        {parentPath ? <small>{parentPath}</small> : null}
      </span>
      <svg
        className="dashboard-bar"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect x="0" y="1" width="100" height="8" rx="2" fill="#e2e8f0" />
        <rect x="0" y="1" width={width} height="8" rx="2" fill="#0f766e" />
      </svg>
      <span className="dashboard-chart-value">{value}</span>
    </button>
  );
}

function nodeIdForFile(index: FileRelationshipIndex, file: string): string | null {
  for (const node of index.nodeById.values()) {
    if (node.relativePath === file) {
      return node.id;
    }
  }

  return null;
}

export function DashboardView({ index, healthScore, onSelectNode }: DashboardViewProps) {
  if (!healthScore) {
    return (
      <section className="dashboard-panel empty-state">
        <div className="panel-header">
          <p className="eyebrow">Health Dashboard</p>
          <h2>No dependency health data</h2>
        </div>
        <p className="empty-copy">Run a dependency scan to populate health metrics.</p>
      </section>
    );
  }

  const maxComplexity = Math.max(1, ...healthScore.hotspots.map((item) => item.complexity));
  const maxInDegree = Math.max(1, ...healthScore.hubs.map((item) => item.inDegree));
  const issueCards = [
    { label: 'Circular', value: healthScore.issues.circularChains },
    { label: 'Orphans', value: healthScore.issues.orphanFiles },
    { label: 'Unused', value: healthScore.issues.unusedExports },
    { label: 'Unresolved', value: healthScore.issues.unresolvedImports },
  ];

  return (
    <section className="dashboard-panel">
      <div className="panel-header inline">
        <div>
          <p className="eyebrow">Health Dashboard</p>
          <h2>Project score</h2>
        </div>
        <div className="dashboard-grade" style={{ background: GRADE_COLORS[healthScore.grade] }}>
          <strong>{healthScore.grade}</strong>
          <span>{healthScore.score}</span>
        </div>
      </div>

      <div className="dashboard-card-grid">
        {issueCards.map((item) => (
          <div className="dashboard-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-section">
          <div className="relationship-heading">
            <h3>Complexity hotspots</h3>
            <span>{healthScore.hotspots.length}</span>
          </div>
          <div className="dashboard-chart">
            {healthScore.hotspots.map((item) => {
              const nodeId = nodeIdForFile(index, item.file);
              return (
                <ChartRow
                  key={item.file}
                  label={item.file}
                  value={item.complexity}
                  max={maxComplexity}
                  onSelect={() => {
                    if (nodeId) {
                      onSelectNode(nodeId);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="relationship-heading">
            <h3>Dependency hubs</h3>
            <span>{healthScore.hubs.length}</span>
          </div>
          <div className="dashboard-chart">
            {healthScore.hubs.map((item) => {
              const nodeId = nodeIdForFile(index, item.file);
              return (
                <ChartRow
                  key={item.file}
                  label={item.file}
                  value={item.inDegree}
                  max={maxInDegree}
                  onSelect={() => {
                    if (nodeId) {
                      onSelectNode(nodeId);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
