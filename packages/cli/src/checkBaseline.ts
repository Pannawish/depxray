import type { ScanResult } from '@depxray/core';

export const CHECK_ISSUE_TYPES = [
  'circularDependencies',
  'orphanFiles',
  'unusedExports',
  'unresolvedImports',
  'architectureErrors',
  'devDepsInProd',
  'importConventionViolations',
] as const;

export type CheckIssueType = (typeof CHECK_ISSUE_TYPES)[number];
export type CheckSummary = Record<CheckIssueType, number>;
export type CheckIssueDetails = Record<CheckIssueType, string[]>;

export interface CheckResultSummary {
  clean: boolean;
  summary: CheckSummary;
}

export interface BaselineComparison {
  newIssues: CheckIssueDetails;
  resolvedIssues: CheckIssueDetails;
  newIssueCount: number;
  resolvedIssueCount: number;
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function collectCheckIssues(result: ScanResult): CheckIssueDetails {
  return {
    circularDependencies: sorted(
      result.graph.circularDependencies.map((cycle) =>
        cycle.chain.slice(0, -1).sort().join(' ↔ '),
      ),
    ),
    orphanFiles: sorted(result.orphanFiles),
    unusedExports: sorted(
      result.graph.nodes.flatMap((node) =>
        (node.unusedExports ?? []).map((item) => `${node.relativePath}:${item.line}:${item.name}`),
      ),
    ),
    unresolvedImports: sorted(
      result.unresolvedImports.map((item) => `${item.file}:${item.line}:${item.importSpecifier}`),
    ),
    architectureErrors: sorted(
      (result.ruleValidation?.violations ?? [])
        .filter((item) => item.severity === 'error')
        .map(
          (item) =>
            `${item.source} -> ${item.target}:${item.importSpecifier}${item.entryPoint ? ` [${item.entryPoint}]` : ''}`,
        ),
    ),
    devDepsInProd: sorted(
      (result.devDepsInProd ?? []).map(
        (item) => `${item.file}:${item.line}:${item.module} [${item.entryPoint}]`,
      ),
    ),
    importConventionViolations: sorted(
      (result.importConventionViolations ?? []).map(
        (item) => `${item.file}:${item.line}:${item.importSpecifier} -> ${item.suggestedSpecifier}`,
      ),
    ),
  };
}

export function buildCheckSummary(result: ScanResult): CheckResultSummary {
  const issues = collectCheckIssues(result);
  const summary = Object.fromEntries(
    CHECK_ISSUE_TYPES.map((type) => [type, issues[type].length]),
  ) as unknown as CheckSummary;

  return {
    clean: Object.values(summary).every((value) => value === 0),
    summary,
  };
}

export function compareCheckResults(baseline: ScanResult, current: ScanResult): BaselineComparison {
  const baselineIssues = collectCheckIssues(baseline);
  const currentIssues = collectCheckIssues(current);
  const newIssues = {} as CheckIssueDetails;
  const resolvedIssues = {} as CheckIssueDetails;

  for (const type of CHECK_ISSUE_TYPES) {
    const baselineSet = new Set(baselineIssues[type]);
    const currentSet = new Set(currentIssues[type]);
    newIssues[type] = currentIssues[type].filter((issue) => !baselineSet.has(issue));
    resolvedIssues[type] = baselineIssues[type].filter((issue) => !currentSet.has(issue));
  }

  return {
    newIssues,
    resolvedIssues,
    newIssueCount: CHECK_ISSUE_TYPES.reduce((total, type) => total + newIssues[type].length, 0),
    resolvedIssueCount: CHECK_ISSUE_TYPES.reduce(
      (total, type) => total + resolvedIssues[type].length,
      0,
    ),
  };
}
