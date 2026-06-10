import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PLUGINS,
  runAfterBuildGraphHooks,
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
});
