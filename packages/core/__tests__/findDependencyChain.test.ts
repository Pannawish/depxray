import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDependencyChain } from '../src/findDependencyChain.js';
import type { DependencyGraph } from '../src/types.js';

const rootDir = '/project';

function node(relativePath: string) {
  return {
    id: path.join(rootDir, relativePath),
    relativePath,
    extension: path.extname(relativePath),
    inDegree: 0,
    outDegree: 0,
    isCircular: false,
  };
}

describe('findDependencyChain', () => {
  it('finds all shortest chains between connected files', () => {
    const app = node('src/App.ts');
    const left = node('src/left.ts');
    const right = node('src/right.ts');
    const helper = node('src/helper.ts');
    const graph: DependencyGraph = {
      rootDir,
      nodes: [app, left, right, helper],
      edges: [
        {
          source: app.id,
          target: left.id,
          importSpecifier: './left',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
        {
          source: app.id,
          target: right.id,
          importSpecifier: './right',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
        {
          source: left.id,
          target: helper.id,
          importSpecifier: './helper',
          importedNames: [],
          isTypeOnly: false,
          isDynamic: false,
        },
        {
          source: right.id,
          target: helper.id,
          importSpecifier: './helper',
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
        totalFiles: 4,
        totalEdges: 4,
        circularCount: 0,
        depxrayVersion: 'test',
      },
    };

    const result = findDependencyChain(graph, 'src/App.ts', 'src/helper.ts');

    expect(result.connected).toBe(true);
    expect(result.shortestDistance).toBe(2);
    expect(result.chains).toEqual([
      ['src/App.ts', 'src/left.ts', 'src/helper.ts'],
      ['src/App.ts', 'src/right.ts', 'src/helper.ts'],
    ]);
  });

  it('reports disconnected files', () => {
    const app = node('src/App.ts');
    const helper = node('src/helper.ts');
    const graph: DependencyGraph = {
      rootDir,
      nodes: [app, helper],
      edges: [],
      circularDependencies: [],
      metadata: {
        scannedAt: '2026-06-11T00:00:00.000Z',
        scanDurationMs: 1,
        projectRoot: rootDir,
        totalFiles: 2,
        totalEdges: 0,
        circularCount: 0,
        depxrayVersion: 'test',
      },
    };

    expect(findDependencyChain(graph, app.id, helper.id)).toMatchObject({
      connected: false,
      chains: [],
      shortestDistance: -1,
    });
  });

  it('returns a zero-length chain when source and target are the same file', () => {
    const app = node('src/App.ts');
    const graph: DependencyGraph = {
      rootDir,
      nodes: [app],
      edges: [],
      circularDependencies: [],
      metadata: {
        scannedAt: '2026-06-11T00:00:00.000Z',
        scanDurationMs: 1,
        projectRoot: rootDir,
        totalFiles: 1,
        totalEdges: 0,
        circularCount: 0,
        depxrayVersion: 'test',
      },
    };

    expect(findDependencyChain(graph, 'src/App.ts', 'src/App.ts')).toEqual({
      connected: true,
      from: 'src/App.ts',
      to: 'src/App.ts',
      chains: [['src/App.ts']],
      shortestDistance: 0,
    });
  });
});
