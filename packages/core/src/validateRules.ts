import type {
  ArchitectureRule,
  DependencyGraph,
  GraphEdge,
  RuleValidationResult,
  RuleViolation,
} from './types.js';
import { matchesAnyPattern } from './detectOrphanFiles.js';

function normalizeSeverity(severity: ArchitectureRule['severity']): 'error' | 'warning' {
  return severity === 'warning' ? 'warning' : 'error';
}

function defaultMessage(rule: ArchitectureRule): string {
  if (rule.from && rule.to) {
    return `Forbidden import from ${rule.from} to ${rule.to}`;
  }

  return 'Restricted import';
}

function edgeMatchesRule(
  edge: GraphEdge,
  graph: DependencyGraph,
  rule: ArchitectureRule,
): RuleViolation | null {
  const source = edge.source.startsWith(graph.rootDir)
    ? edge.source.replace(graph.rootDir + '/', '')
    : edge.source;
  const target = edge.target.startsWith(graph.rootDir)
    ? edge.target.replace(graph.rootDir + '/', '')
    : edge.target;

  if (!rule.from || !rule.to) {
    return null;
  }

  if (!matchesAnyPattern(source, [rule.from]) || !matchesAnyPattern(target, [rule.to])) {
    return null;
  }

  return {
    source,
    target,
    importSpecifier: edge.importSpecifier,
    from: rule.from,
    to: rule.to,
    severity: normalizeSeverity(rule.severity),
    message: rule.message ?? defaultMessage(rule),
  };
}

export function validateRules(
  graph: DependencyGraph,
  rules: ArchitectureRule[] = [],
): RuleValidationResult {
  const violations: RuleViolation[] = [];
  const globalRules = rules.filter((rule) => rule.from && rule.to);

  for (const edge of graph.edges) {
    for (const rule of globalRules) {
      const violation = edgeMatchesRule(edge, graph, rule);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  return {
    violations,
    errorCount: violations.filter((violation) => violation.severity === 'error').length,
    warningCount: violations.filter((violation) => violation.severity === 'warning').length,
  };
}

export function attachRuleViolations(
  graph: DependencyGraph,
  validation: RuleValidationResult,
): DependencyGraph {
  if (validation.violations.length === 0) {
    return graph;
  }

  const violationsByEdge = new Map<string, RuleViolation[]>();
  for (const violation of validation.violations) {
    const key = `${violation.source}->${violation.target}->${violation.importSpecifier}`;
    const current = violationsByEdge.get(key);
    if (current) {
      current.push(violation);
    } else {
      violationsByEdge.set(key, [violation]);
    }
  }

  return {
    ...graph,
    edges: graph.edges.map((edge) => {
      const source = edge.source.startsWith(graph.rootDir)
        ? edge.source.replace(graph.rootDir + '/', '')
        : edge.source;
      const target = edge.target.startsWith(graph.rootDir)
        ? edge.target.replace(graph.rootDir + '/', '')
        : edge.target;
      const key = `${source}->${target}->${edge.importSpecifier}`;
      const ruleViolations = violationsByEdge.get(key);

      return ruleViolations
        ? { ...edge, ruleViolations }
        : edge;
    }),
  };
}
