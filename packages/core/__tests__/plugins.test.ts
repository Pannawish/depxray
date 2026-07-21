import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PLUGINS,
  runAfterBuildGraphHooks,
  runReportHooks,
  runAfterScanHooks,
} from '../src/plugins.js';
import type { DependencyGraph, ScanResult } from '../src/types.js';

function createGraph(): DependencyGraph {
  return {
    rootDir: '/project',
    nodes: [
      {
        id: '/project/src/index.ts',
        relativePath: 'src/index.ts',
        extension: '.ts',
        inDegree: 0,
        outDegree: 0,
        isCircular: false,
        metrics: {
          loc: 5,
          cyclomaticComplexity: 2,
          exportCount: 1,
          instability: 0,
        },
      },
    ],
    edges: [],
    circularDependencies: [],
    metadata: {
      scannedAt: '2026-06-11T00:00:00.000Z',
      scanDurationMs: 1,
      projectRoot: '/project',
      totalFiles: 1,
      totalEdges: 0,
      circularCount: 0,
      depxrayVersion: 'test',
    },
  };
}

function createResult(): ScanResult {
  return {
    graph: createGraph(),
    totalFiles: 1,
    totalImports: 0,
    circularCount: 0,
    orphanFiles: ['src/index.ts'],
    unresolvedImports: [],
    errors: [],
    durationMs: 1,
  };
}

describe('plugin hooks', () => {
  it('runs afterBuildGraph hooks in order', async () => {
    const graph = await runAfterBuildGraphHooks(
      createGraph(),
      [
        {
          name: 'node-marker',
          afterBuildGraph(currentGraph) {
            return {
              ...currentGraph,
              nodes: currentGraph.nodes.map((node) => ({
                ...node,
                pluginData: { marker: true },
              })),
            };
          },
        },
      ],
      { rootDir: '/project' },
    );

    expect(graph.nodes[0].pluginData).toEqual({ marker: true });
  });

  it('runs afterScan hooks and built-in complexity plugin', async () => {
    const result = await runAfterScanHooks(
      createResult(),
      [
        BUILT_IN_PLUGINS['@depxray/plugin-complexity'],
        {
          name: 'summary-marker',
          afterScan(currentResult) {
            return {
              ...currentResult,
              pluginData: {
                ...currentResult.pluginData,
                marker: { files: currentResult.totalFiles },
              },
            };
          },
        },
      ],
      { rootDir: '/project' },
    );

    expect(result.pluginData?.complexity).toMatchObject({
      totalLoc: 5,
      maxComplexity: 2,
    });
    expect(result.pluginData?.marker).toEqual({ files: 1 });
  });

  it('formats dependency diffs with the built-in GitHub PR plugin', async () => {
    const result = (await runReportHooks(
      {
        addedFiles: ['src/new.ts'],
        removedFiles: [],
        addedEdges: [{ source: 'src/index.ts', target: 'src/new.ts' }],
        removedEdges: [],
        addedCircularDependencies: ['src/a.ts -> src/b.ts -> src/a.ts'],
        removedCircularDependencies: [],
      },
      [BUILT_IN_PLUGINS['@depxray/plugin-github-pr']],
      { rootDir: '/project' },
    )) as { markdownComment?: string };

    expect(result.markdownComment).toContain('depxray Dependency Report');
    expect(result.markdownComment).toContain('Added files');
    expect(result.markdownComment).toContain('src/new.ts');
    expect(result.markdownComment).toContain('New circular dependencies');
  });
});
