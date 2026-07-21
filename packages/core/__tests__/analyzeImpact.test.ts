import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeImpact } from '../src/analyzeImpact.js';
import type { DependencyGraph } from '../src/types.js';

const rootDir = '/project';

function file(relativePath: string, inDegree: number, outDegree: number, complexity = 1) {
  return {
    id: path.join(rootDir, relativePath),
    relativePath,
    extension: path.extname(relativePath),
    inDegree,
    outDegree,
    isCircular: false,
    metrics: {
      loc: 20,
      cyclomaticComplexity: complexity,
      exportCount: 1,
      instability: outDegree / (inDegree + outDegree || 1),
    },
  };
}

describe('analyzeImpact', () => {
  it('finds direct and transitive dependents for a target file', () => {
    const shared = file('src/shared.ts', 2, 0, 12);
    const button = file('src/Button.tsx', 1, 1);
    const page = file('src/Page.tsx', 1, 1);
    const app = file('src/App.tsx', 0, 1);
    const test = file('src/shared.test.ts', 0, 1);
    const graph: DependencyGraph = {
      rootDir,
      nodes: [shared, button, page, app, test],
      edges: [
        {
          source: button.id,
          target: shared.id,
          importSpecifier: './shared',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
        {
          source: test.id,
          target: shared.id,
          importSpecifier: './shared',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
        {
          source: page.id,
          target: button.id,
          importSpecifier: './Button',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
        {
          source: app.id,
          target: page.id,
          importSpecifier: './Page',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
      ],
      circularDependencies: [],
      metadata: {
        scannedAt: '2026-06-11T00:00:00.000Z',
        scanDurationMs: 1,
        projectRoot: rootDir,
        totalFiles: 5,
        totalEdges: 4,
        circularCount: 0,
        depxrayVersion: '0.0.0-test',
      },
    };

    const impact = analyzeImpact(graph, 'src/shared.ts', {
      complexityThreshold: 10,
      impactThreshold: 3,
      inboundThreshold: 2,
    });

    expect(impact.target.file).toBe('src/shared.ts');
    expect(impact.directDependentCount).toBe(2);
    expect(impact.affectedFiles.map((item) => item.file)).toEqual([
      'src/Button.tsx',
      'src/shared.test.ts',
      'src/Page.tsx',
      'src/App.tsx',
    ]);
    expect(impact.affectedFiles.find((item) => item.file === 'src/App.tsx')?.path).toEqual([
      'src/App.tsx',
      'src/Page.tsx',
      'src/Button.tsx',
      'src/shared.ts',
    ]);
    expect(impact.target.riskFactors).toContain('4 transitive dependents');
    expect(impact.target.riskFactors).toContain('complexity 12');
    expect(impact.highImpactComplexFiles.map((item) => item.file)).toEqual(['src/shared.ts']);
    expect(impact.risk).toBe('high');
  });
});
