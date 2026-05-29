import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildGraph } from '../src/buildGraph.js';
import type { ResolvedImport, ScanMetadata } from '../src/types.js';

const ROOT_DIR = '/test/project';

function makeMeta(): ScanMetadata {
  return {
    scannedAt: new Date().toISOString(),
    scanDurationMs: 0,
    projectRoot: ROOT_DIR,
    totalFiles: 0,
    totalEdges: 0,
    circularCount: 0,
    rdgVersion: '0.1.0',
  };
}

function makeResolved(
  source: string,
  resolvedPath: string | null,
): ResolvedImport {
  return {
    raw: {
      source: source,
      specifiers: [],
      isTypeOnly: false,
      isDynamic: false,
      line: 1,
    },
    resolvedPath,
  };
}

describe('buildGraph', () => {
  it('should create nodes for all files', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, []);
    fileImports.set(`${ROOT_DIR}/src/Button.tsx`, []);
    fileImports.set(`${ROOT_DIR}/src/utils.ts`, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.map((n) => n.relativePath).sort()).toEqual([
      'src/App.tsx',
      'src/Button.tsx',
      'src/utils.ts',
    ]);
  });

  it('should create edges for resolved imports', () => {
    const appPath = `${ROOT_DIR}/src/App.tsx`;
    const buttonPath = `${ROOT_DIR}/src/Button.tsx`;
    const utilsPath = `${ROOT_DIR}/src/utils.ts`;

    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(appPath, [
      makeResolved('./Button', buttonPath),
      makeResolved('./utils', utilsPath),
    ]);
    fileImports.set(buttonPath, []);
    fileImports.set(utilsPath, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0].source).toBe(appPath);
    expect(graph.edges[0].target).toBe(buttonPath);
    expect(graph.edges[1].source).toBe(appPath);
    expect(graph.edges[1].target).toBe(utilsPath);
  });

  it('should skip unresolved imports (external packages)', () => {
    const appPath = `${ROOT_DIR}/src/App.tsx`;

    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(appPath, [
      makeResolved('react', null), // External — should be skipped
      makeResolved('./Button', `${ROOT_DIR}/src/Button.tsx`),
    ]);
    fileImports.set(`${ROOT_DIR}/src/Button.tsx`, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].target).toBe(`${ROOT_DIR}/src/Button.tsx`);
  });

  it('should calculate inDegree and outDegree correctly', () => {
    const appPath = `${ROOT_DIR}/src/App.tsx`;
    const buttonPath = `${ROOT_DIR}/src/Button.tsx`;
    const utilsPath = `${ROOT_DIR}/src/utils.ts`;

    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(appPath, [
      makeResolved('./Button', buttonPath),
      makeResolved('./utils', utilsPath),
    ]);
    fileImports.set(buttonPath, [
      makeResolved('./utils', utilsPath),
    ]);
    fileImports.set(utilsPath, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    const appNode = graph.nodes.find((n) => n.id === appPath)!;
    const buttonNode = graph.nodes.find((n) => n.id === buttonPath)!;
    const utilsNode = graph.nodes.find((n) => n.id === utilsPath)!;

    // App imports 2 files
    expect(appNode.outDegree).toBe(2);
    expect(appNode.inDegree).toBe(0);

    // Button imports 1, imported by 1
    expect(buttonNode.outDegree).toBe(1);
    expect(buttonNode.inDegree).toBe(1);

    // Utils imports 0, imported by 2
    expect(utilsNode.outDegree).toBe(0);
    expect(utilsNode.inDegree).toBe(2);
  });

  it('should add nodes for import targets not in the original file list', () => {
    const appPath = `${ROOT_DIR}/src/App.tsx`;
    const externalLocalPath = `${ROOT_DIR}/src/SharedLib.tsx`;

    const fileImports = new Map<string, ResolvedImport[]>();
    // Only App.tsx is scanned, but it imports SharedLib.tsx which
    // wasn't in our initial file list
    fileImports.set(appPath, [
      makeResolved('./SharedLib', externalLocalPath),
    ]);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    // Both App and SharedLib should be nodes
    expect(graph.nodes).toHaveLength(2);
    const sharedNode = graph.nodes.find((n) => n.id === externalLocalPath);
    expect(sharedNode).toBeDefined();
    expect(sharedNode!.inDegree).toBe(1);
  });

  it('should set correct file extensions', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, []);
    fileImports.set(`${ROOT_DIR}/src/utils.ts`, []);
    fileImports.set(`${ROOT_DIR}/src/legacy.js`, []);
    fileImports.set(`${ROOT_DIR}/src/Component.jsx`, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    const extensions = graph.nodes.map((n) => n.extension).sort();
    expect(extensions).toEqual(['.js', '.jsx', '.ts', '.tsx']);
  });

  it('should initialize isCircular to false', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/A.ts`, [
      makeResolved('./B', `${ROOT_DIR}/src/B.ts`),
    ]);
    fileImports.set(`${ROOT_DIR}/src/B.ts`, [
      makeResolved('./A', `${ROOT_DIR}/src/A.ts`),
    ]);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    // buildGraph doesn't detect cycles — that's detectCircularDeps' job
    for (const node of graph.nodes) {
      expect(node.isCircular).toBe(false);
    }
  });
});
