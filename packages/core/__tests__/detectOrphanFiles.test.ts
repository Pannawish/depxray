import { describe, expect, it } from 'vitest';
import { detectOrphanFiles, matchesAnyPattern } from '../src/detectOrphanFiles.js';
import type { DependencyGraph } from '../src/types.js';

function makeGraph(): DependencyGraph {
  return {
    rootDir: '/project',
    nodes: [
      {
        id: '/project/src/App.tsx',
        relativePath: 'src/App.tsx',
        extension: '.tsx',
        inDegree: 0,
        outDegree: 2,
        isCircular: false,
      },
      {
        id: '/project/src/index.ts',
        relativePath: 'src/index.ts',
        extension: '.ts',
        inDegree: 0,
        outDegree: 1,
        isCircular: false,
      },
      {
        id: '/project/src/unused.ts',
        relativePath: 'src/unused.ts',
        extension: '.ts',
        inDegree: 0,
        outDegree: 0,
        isCircular: false,
      },
      {
        id: '/project/src/Button.test.tsx',
        relativePath: 'src/Button.test.tsx',
        extension: '.tsx',
        inDegree: 0,
        outDegree: 0,
        isCircular: false,
      },
      {
        id: '/project/src/used.ts',
        relativePath: 'src/used.ts',
        extension: '.ts',
        inDegree: 1,
        outDegree: 0,
        isCircular: false,
      },
    ],
    edges: [],
    circularDependencies: [],
    metadata: {
      scannedAt: '2026-06-09T00:00:00.000Z',
      scanDurationMs: 1,
      projectRoot: '/project',
      totalFiles: 5,
      totalEdges: 0,
      circularCount: 0,
      depxrayVersion: 'test',
    },
  };
}

describe('detectOrphanFiles', () => {
  it('matches glob-like entry point patterns at root and nested paths', () => {
    expect(matchesAnyPattern('index.ts', ['**/index.*'])).toBe(true);
    expect(matchesAnyPattern('src/index.ts', ['**/index.*'])).toBe(true);
    expect(matchesAnyPattern('src/Button.test.tsx', ['**/*.test.*'])).toBe(true);
    expect(matchesAnyPattern('src/Button.tsx', ['**/*.test.*'])).toBe(false);
  });

  it('returns zero-in-degree files excluding default entry points', () => {
    expect(detectOrphanFiles(makeGraph())).toEqual(['src/unused.ts']);
  });

  it('allows callers to configure entry point exclusions', () => {
    expect(
      detectOrphanFiles(makeGraph(), {
        entryPointPatterns: ['src/unused.ts'],
      }),
    ).toEqual([
      'src/App.tsx',
      'src/Button.test.tsx',
      'src/index.ts',
    ]);
  });
});
