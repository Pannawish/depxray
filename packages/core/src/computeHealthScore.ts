import type { ScanResult } from './types.js';

export interface HealthScoreResult {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
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
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function gradeForScore(score: number): HealthScoreResult['grade'] {
  if (score >= 90) {
    return 'A';
  }
  if (score >= 80) {
    return 'B';
  }
  if (score >= 70) {
    return 'C';
  }
  if (score >= 60) {
    return 'D';
  }
  return 'F';
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
  let score = 100;

  score -= Math.min(25, issues.circularChains * 5);
  score -= Math.min(20, issues.orphanFiles * 2);
  score -= Math.min(15, issues.unusedExports * 0.5);
  score -= Math.min(15, issues.unresolvedImports * 3);
  score -= Math.min(25, issues.ruleViolations * 5);

  if (averageComplexity > 10) {
    score -= 10;
  }
  if (averageComplexity > 20) {
    score -= 10;
  }

  const finalScore = clampScore(score);
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
  };
}
