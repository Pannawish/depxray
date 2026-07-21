import { describe, expect, it } from 'vitest';
import { computeHealthScore } from '../src/computeHealthScore.js';
import type { DependencyGraph, ScanResult } from '../src/types.js';

function createResult(): ScanResult {
  const graph: DependencyGraph = {
    rootDir: '/project',
    nodes: [
      {
        id: '/project/src/index.ts',
        relativePath: 'src/index.ts',
        extension: '.ts',
        inDegree: 0,
        outDegree: 1,
        isCircular: false,
        metrics: { loc: 10, cyclomaticComplexity: 2, exportCount: 1, instability: 1 },
      },
      {
        id: '/project/src/helper.ts',
        relativePath: 'src/helper.ts',
        extension: '.ts',
        inDegree: 3,
        outDegree: 0,
        isCircular: false,
        unusedExports: [{ name: 'unused', kind: 'named', isTypeOnly: false, line: 3 }],
        metrics: { loc: 40, cyclomaticComplexity: 12, exportCount: 2, instability: 0 },
      },
    ],
    edges: [],
    circularDependencies: [],
    metadata: {
      scannedAt: '2026-06-11T00:00:00.000Z',
      scanDurationMs: 1,
      projectRoot: '/project',
      totalFiles: 2,
      totalEdges: 0,
      circularCount: 0,
      depxrayVersion: 'test',
    },
  };

  return {
    graph,
    totalFiles: 2,
    totalImports: 0,
    circularCount: 1,
    orphanFiles: ['src/index.ts'],
    unresolvedImports: [
      {
        file: 'src/index.ts',
        absoluteFilePath: '/project/src/index.ts',
        importSpecifier: './missing',
        line: 1,
        isTypeOnly: false,
        isDynamic: false,
      },
    ],
    errors: [],
    durationMs: 1,
  };
}

describe('computeHealthScore', () => {
  it('computes a bounded grade, issue counts, hotspots, and hubs', () => {
    const result = computeHealthScore(createResult());

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toMatch(/^[A-F]$/);
    expect(result.issues).toMatchObject({
      circularChains: 1,
      orphanFiles: 1,
      unusedExports: 1,
      unresolvedImports: 1,
    });
    expect(result.hotspots[0]).toEqual({
      file: 'src/helper.ts',
      complexity: 12,
      loc: 40,
    });
    expect(result.hubs[0]).toEqual({
      file: 'src/helper.ts',
      inDegree: 3,
      outDegree: 0,
    });
    expect(result.score).toBe(90);
    expect(result.breakdown).toMatchObject({
      startingScore: 100,
      totalDeductions: 10.5,
      averageComplexity: 7,
    });
    expect(result.breakdown.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'circularChains', points: 5 }),
        expect.objectContaining({ key: 'unusedExports', points: 0.5 }),
        expect.objectContaining({ key: 'averageComplexity', points: 0 }),
      ]),
    );
    expect(result.breakdown.gradeThresholds.map((threshold) => threshold.grade)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'F',
    ]);
  });
});
