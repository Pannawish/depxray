import { describe, it, expect } from 'vitest';
import { detectCircularDeps } from '../src/detectCircularDeps.js';
import { buildGraph } from '../src/buildGraph.js';
import type { ResolvedImport, ScanMetadata, DependencyGraph } from '../src/types.js';

const ROOT_DIR = '/test/project';

function makeMeta(): ScanMetadata {
  return {
    scannedAt: new Date().toISOString(),
    scanDurationMs: 0,
    projectRoot: ROOT_DIR,
    totalFiles: 0,
    totalEdges: 0,
    circularCount: 0,
    depxrayVersion: '0.3.0',
  };
}

function makeResolved(source: string, resolvedPath: string): ResolvedImport {
  return {
    raw: {
      source,
      specifiers: [],
      isTypeOnly: false,
      isDynamic: false,
      line: 1,
    },
    resolvedPath,
  };
}

function buildTestGraph(
  edges: Array<[string, string]>,
): DependencyGraph {
  const fileImports = new Map<string, ResolvedImport[]>();
  const allFiles = new Set<string>();

  for (const [from, to] of edges) {
    allFiles.add(from);
    allFiles.add(to);
  }

  for (const file of allFiles) {
    const imports = edges
      .filter(([from]) => from === file)
      .map(([, to]) => makeResolved(to, to));
    fileImports.set(file, imports);
  }

  return buildGraph(fileImports, ROOT_DIR, makeMeta());
}

describe('detectCircularDeps', () => {
  it('should detect a simple 2-node cycle (A → B → A)', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;

    const graph = buildTestGraph([
      [A, B],
      [B, A],
    ]);

    detectCircularDeps(graph);

    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(1);

    // Both nodes should be marked circular
    const nodeA = graph.nodes.find((n) => n.id === A)!;
    const nodeB = graph.nodes.find((n) => n.id === B)!;
    expect(nodeA.isCircular).toBe(true);
    expect(nodeB.isCircular).toBe(true);
  });

  it('should detect a 3-node cycle (A → B → C → A)', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;
    const C = `${ROOT_DIR}/src/C.ts`;

    const graph = buildTestGraph([
      [A, B],
      [B, C],
      [C, A],
    ]);

    detectCircularDeps(graph);

    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(1);

    // All three should be circular
    for (const id of [A, B, C]) {
      const node = graph.nodes.find((n) => n.id === id)!;
      expect(node.isCircular).toBe(true);
    }
  });

  it('should not flag non-circular graphs', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;
    const C = `${ROOT_DIR}/src/C.ts`;

    const graph = buildTestGraph([
      [A, B],
      [A, C],
      [B, C],
    ]);

    detectCircularDeps(graph);

    expect(graph.circularDependencies).toHaveLength(0);

    for (const node of graph.nodes) {
      expect(node.isCircular).toBe(false);
    }
  });

  it('should detect multiple independent cycles', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;
    const C = `${ROOT_DIR}/src/C.ts`;
    const D = `${ROOT_DIR}/src/D.ts`;

    const graph = buildTestGraph([
      [A, B],
      [B, A], // Cycle 1: A ↔ B
      [C, D],
      [D, C], // Cycle 2: C ↔ D
    ]);

    detectCircularDeps(graph);

    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(2);

    for (const id of [A, B, C, D]) {
      const node = graph.nodes.find((n) => n.id === id)!;
      expect(node.isCircular).toBe(true);
    }
  });

  it('should not flag standalone nodes as circular', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;
    const standalone = `${ROOT_DIR}/src/standalone.ts`;

    const graph = buildTestGraph([
      [A, B],
      [B, A],
      // standalone has no edges at all
    ]);

    // Manually add standalone as a file with no imports
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(A, [makeResolved('./B', B)]);
    fileImports.set(B, [makeResolved('./A', A)]);
    fileImports.set(standalone, []);
    const fullGraph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    detectCircularDeps(fullGraph);

    const standaloneNode = fullGraph.nodes.find(
      (n) => n.id === standalone,
    )!;
    expect(standaloneNode.isCircular).toBe(false);
  });

  it('should handle empty graph', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    detectCircularDeps(graph);

    expect(graph.circularDependencies).toHaveLength(0);
    expect(graph.metadata.circularCount).toBe(0);
  });

  it('should produce readable descriptions in CircularChain', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;

    const graph = buildTestGraph([
      [A, B],
      [B, A],
    ]);

    detectCircularDeps(graph);

    const chain = graph.circularDependencies[0];
    expect(chain.description).toContain('→');
    expect(chain.chain.length).toBeGreaterThanOrEqual(3); // A, B, A (cycle repeated)
  });

  it('should update metadata.circularCount', () => {
    const A = `${ROOT_DIR}/src/A.ts`;
    const B = `${ROOT_DIR}/src/B.ts`;

    const graph = buildTestGraph([
      [A, B],
      [B, A],
    ]);

    detectCircularDeps(graph);

    expect(graph.metadata.circularCount).toBeGreaterThanOrEqual(1);
  });
});
