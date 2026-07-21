import { useState } from 'react';
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
  const [showScoreInfo, setShowScoreInfo] = useState(false);

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
    {
      label: 'Circular',
      value: healthScore.issues.circularChains,
      description: 'Dependency cycles',
    },
    {
      label: 'Orphans',
      value: healthScore.issues.orphanFiles,
      description: 'Files with no incoming imports',
    },
    {
      label: 'Unused',
      value: healthScore.issues.unusedExports,
      description: 'Unreferenced internal exports',
    },
    {
      label: 'Unresolved',
      value: healthScore.issues.unresolvedImports,
      description: 'Local imports not resolved',
    },
    {
      label: 'Rules',
      value: healthScore.issues.ruleViolations,
      description: 'Error-level architecture violations',
    },
  ];
  const breakdown = healthScore.breakdown;

  return (
    <section className="dashboard-panel">
      <div className="panel-header inline">
        <div className="dashboard-score-heading">
          <div>
            <p className="eyebrow">Health Dashboard</p>
            <h2>Project score</h2>
          </div>
          <button
            aria-controls="health-score-explanation"
            aria-expanded={showScoreInfo}
            aria-label={showScoreInfo ? 'Hide health score explanation' : 'Explain health score'}
            className="dashboard-info-button"
            onClick={() => setShowScoreInfo((current) => !current)}
            title="How is this score calculated?"
            type="button"
          >
            i
          </button>
        </div>
        <div className="dashboard-grade" style={{ background: GRADE_COLORS[healthScore.grade] }}>
          <strong>{healthScore.grade}</strong>
          <span>{healthScore.score}</span>
        </div>
      </div>

      {showScoreInfo ? (
        <section
          aria-label="Health score explanation"
          className="dashboard-score-info"
          id="health-score-explanation"
        >
          <div className="dashboard-score-info-heading">
            <div>
              <p className="eyebrow">Scoring method</p>
              <h3>How the project score is calculated</h3>
            </div>
            {breakdown ? (
              <div className="dashboard-score-equation" aria-label="Score calculation">
                <span>{breakdown.startingScore}</span>
                <small>−</small>
                <span>{breakdown.totalDeductions}</span>
                <small>=</small>
                <strong>{healthScore.score}</strong>
              </div>
            ) : null}
          </div>

          <p className="dashboard-score-note">
            Every scan starts at 100. Depxray subtracts capped deductions for dependency and
            maintainability risks, then rounds and clamps the result between 0 and 100.
          </p>

          {breakdown ? (
            <>
              <div className="dashboard-grade-scale" aria-label="Grade thresholds">
                {breakdown.gradeThresholds.map((threshold) => (
                  <span
                    className={threshold.grade === healthScore.grade ? 'active' : ''}
                    key={threshold.grade}
                  >
                    <strong>{threshold.grade}</strong>
                    <small>{threshold.label}</small>
                  </span>
                ))}
              </div>

              <div className="dashboard-deduction-list">
                {breakdown.deductions.map((deduction) => (
                  <div className="dashboard-deduction-row" key={deduction.key}>
                    <div>
                      <strong>{deduction.label}</strong>
                      <span>{deduction.observedLabel}</span>
                      <small>{deduction.rule}</small>
                    </div>
                    <span
                      className={
                        deduction.points > 0 ? 'deduction-points' : 'deduction-points zero'
                      }
                    >
                      −{deduction.points} pt{deduction.points === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="dashboard-score-legacy">
              This report was generated by an older Depxray version. Run a new dependency scan to
              see its exact deduction breakdown.
            </p>
          )}

          <p className="dashboard-score-footnote">
            The score is a directional engineering signal, not a substitute for tests, security
            review, or team-specific architecture requirements.
          </p>
        </section>
      ) : null}

      <div className="dashboard-card-grid">
        {issueCards.map((item) => (
          <div className="dashboard-card" key={item.label} title={item.description}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.description}</small>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-section">
          <div className="relationship-heading">
            <h3>Complexity hotspots</h3>
            <span>{healthScore.hotspots.length}</span>
          </div>
          <p className="dashboard-section-description">
            Files ranked by cyclomatic complexity—the number of independent decision paths.
          </p>
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
          <p className="dashboard-section-description">
            Files ranked by incoming imports. High values indicate a larger change blast radius.
          </p>
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
