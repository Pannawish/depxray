import { describe, expect, it } from 'vitest';
import { attachRuleViolations, validateRules } from '../src/validateRules.js';
import type { DependencyGraph } from '../src/types.js';

function makeGraph(): DependencyGraph {
  return {
    rootDir: '/project',
    nodes: [
      {
        id: '/project/src/ui/Button.ts',
        relativePath: 'src/ui/Button.ts',
        extension: '.ts',
        inDegree: 0,
        outDegree: 1,
        isCircular: false,
      },
      {
        id: '/project/src/db/client.ts',
        relativePath: 'src/db/client.ts',
        extension: '.ts',
        inDegree: 1,
        outDegree: 0,
        isCircular: false,
      },
    ],
    edges: [
      {
        source: '/project/src/ui/Button.ts',
        target: '/project/src/db/client.ts',
        importSpecifier: '../db/client',
        importedNames: ['client'],
        isTypeOnly: false,
        isDynamic: false,
      },
    ],
    circularDependencies: [],
    metadata: {
      scannedAt: '2026-06-10T00:00:00.000Z',
      scanDurationMs: 1,
      projectRoot: '/project',
      totalFiles: 2,
      totalEdges: 1,
      circularCount: 0,
      depxrayVersion: 'test',
    },
  };
}

describe('validateRules', () => {
  it('finds forbidden import violations and counts severities', () => {
    const result = validateRules(makeGraph(), [
      {
        from: 'src/ui/**',
        to: 'src/db/**',
        severity: 'error',
        message: 'UI cannot import DB',
      },
    ]);

    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);
    expect(result.violations[0]).toMatchObject({
      source: 'src/ui/Button.ts',
      target: 'src/db/client.ts',
      severity: 'error',
      message: 'UI cannot import DB',
    });
  });

  it('attaches violations to matching graph edges', () => {
    const graph = makeGraph();
    const validation = validateRules(graph, [{ from: 'src/ui/**', to: 'src/db/**' }]);
    const nextGraph = attachRuleViolations(graph, validation);

    expect(nextGraph.edges[0].ruleViolations?.[0].message).toBe(
      'Forbidden import from src/ui/** to src/db/**',
    );
  });
});
