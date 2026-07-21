import type { ScanResult } from './types.js';

export type HealthScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type HealthScoreDeductionKey =
  | 'circularChains'
  | 'orphanFiles'
  | 'unusedExports'
  | 'unresolvedImports'
  | 'ruleViolations'
  | 'averageComplexity';

export interface HealthScoreDeduction {
  key: HealthScoreDeductionKey;
  label: string;
  observedValue: number;
  observedLabel: string;
  points: number;
  rule: string;
}

export interface HealthScoreBreakdown {
  startingScore: 100;
  totalDeductions: number;
  averageComplexity: number;
  deductions: HealthScoreDeduction[];
  gradeThresholds: Array<{
    grade: HealthScoreGrade;
    minimumScore: number;
    label: string;
  }>;
}

export interface HealthScoreResult {
  grade: HealthScoreGrade;
  score: number;
  issues: {
    circularChains: number;
    orphanFiles: number;
    unusedExports: number;
    unresolvedImports: number;
    ruleViolations: number;
  };
  hotspots: Array<{
    file: string;
    complexity: number;
    loc: number;
  }>;
  hubs: Array<{
    file: string;
    inDegree: number;
    outDegree: number;
  }>;
  /** Detailed scoring data. Optional when reading reports generated before this field existed. */
  breakdown?: HealthScoreBreakdown;
}

const GRADE_THRESHOLDS: HealthScoreBreakdown['gradeThresholds'] = [
  { grade: 'A', minimumScore: 90, label: '90–100' },
  { grade: 'B', minimumScore: 80, label: '80–89' },
  { grade: 'C', minimumScore: 70, label: '70–79' },
  { grade: 'D', minimumScore: 60, label: '60–69' },
  { grade: 'F', minimumScore: 0, label: '0–59' },
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function gradeForScore(score: number): HealthScoreResult['grade'] {
  return GRADE_THRESHOLDS.find((threshold) => score >= threshold.minimumScore)?.grade ?? 'F';
}

export function computeHealthScore(result: ScanResult): HealthScoreResult {
  const unusedExportCount = result.graph.nodes.reduce(
    (count, node) => count + (node.unusedExports?.length ?? 0),
    0,
  );
  const issues: HealthScoreResult['issues'] = {
    circularChains: result.circularCount,
    orphanFiles: result.orphanFiles.length,
    unusedExports: unusedExportCount,
    unresolvedImports: result.unresolvedImports.length,
    ruleViolations: result.ruleValidation?.errorCount ?? 0,
  };
  const complexityValues = result.graph.nodes
    .map((node) => node.metrics?.cyclomaticComplexity ?? 0)
    .filter((complexity) => complexity > 0);
  const averageComplexity =
    complexityValues.length === 0
      ? 0
      : complexityValues.reduce((sum, value) => sum + value, 0) / complexityValues.length;
  const complexityDeduction = averageComplexity > 20 ? 20 : averageComplexity > 10 ? 10 : 0;
  const deductions: HealthScoreDeduction[] = [
    {
      key: 'circularChains',
      label: 'Circular dependencies',
      observedValue: issues.circularChains,
      observedLabel: `${issues.circularChains} chain${issues.circularChains === 1 ? '' : 's'}`,
      points: Math.min(25, issues.circularChains * 5),
      rule: '5 points per circular chain, capped at 25 points.',
    },
    {
      key: 'orphanFiles',
      label: 'Orphan files',
      observedValue: issues.orphanFiles,
      observedLabel: `${issues.orphanFiles} file${issues.orphanFiles === 1 ? '' : 's'}`,
      points: Math.min(20, issues.orphanFiles * 2),
      rule: '2 points per file with no incoming imports, capped at 20 points.',
    },
    {
      key: 'unusedExports',
      label: 'Unused exports',
      observedValue: issues.unusedExports,
      observedLabel: `${issues.unusedExports} export${issues.unusedExports === 1 ? '' : 's'}`,
      points: Math.min(15, issues.unusedExports * 0.5),
      rule: '0.5 points per unused internal export, capped at 15 points.',
    },
    {
      key: 'unresolvedImports',
      label: 'Unresolved imports',
      observedValue: issues.unresolvedImports,
      observedLabel: `${issues.unresolvedImports} import${issues.unresolvedImports === 1 ? '' : 's'}`,
      points: Math.min(15, issues.unresolvedImports * 3),
      rule: '3 points per unresolved local import, capped at 15 points.',
    },
    {
      key: 'ruleViolations',
      label: 'Architecture violations',
      observedValue: issues.ruleViolations,
      observedLabel: `${issues.ruleViolations} error${issues.ruleViolations === 1 ? '' : 's'}`,
      points: Math.min(25, issues.ruleViolations * 5),
      rule: '5 points per error-level architecture violation, capped at 25 points.',
    },
    {
      key: 'averageComplexity',
      label: 'Average complexity',
      observedValue: averageComplexity,
      observedLabel: `${averageComplexity.toFixed(1)} average`,
      points: complexityDeduction,
      rule: '10 points above an average of 10, or 20 points above an average of 20.',
    },
  ];
  const totalDeductions = deductions.reduce((total, deduction) => total + deduction.points, 0);
  const finalScore = clampScore(100 - totalDeductions);
  const hotspots = [...result.graph.nodes]
    .filter((node) => node.metrics)
    .sort(
      (a, b) =>
        (b.metrics?.cyclomaticComplexity ?? 0) - (a.metrics?.cyclomaticComplexity ?? 0) ||
        (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0) ||
        a.relativePath.localeCompare(b.relativePath),
    )
    .slice(0, 5)
    .map((node) => ({
      file: node.relativePath,
      complexity: node.metrics?.cyclomaticComplexity ?? 0,
      loc: node.metrics?.loc ?? 0,
    }));
  const hubs = [...result.graph.nodes]
    .sort(
      (a, b) =>
        b.inDegree - a.inDegree ||
        b.outDegree - a.outDegree ||
        a.relativePath.localeCompare(b.relativePath),
    )
    .slice(0, 5)
    .map((node) => ({
      file: node.relativePath,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
    }));

  return {
    grade: gradeForScore(finalScore),
    score: finalScore,
    issues,
    hotspots,
    hubs,
    breakdown: {
      startingScore: 100,
      totalDeductions,
      averageComplexity,
      deductions,
      gradeThresholds: GRADE_THRESHOLDS,
    },
  };
}
