import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildStructureGraph } from '../src/buildStructureGraph.js';
import {
  assertExplorerGraphData,
  assertExplorerGraphSet,
  GRAPH_PAYLOAD_SCHEMA_VERSION,
} from '../src/graphContract.js';
import {
  createDependencyGraphPayload,
  createStructureGraphPayload,
} from '../src/graphPayload.js';
import { scanFileTree } from '../src/scanFileTree.js';
import { scanProject } from '../src/scanProject.js';

const SIMPLE_PROJECT = path.resolve(__dirname, 'fixtures/simple-project');
const GENERATED_BY = 'depxray-test/1.0.0';

describe('graph payload contract', () => {
  it('creates a versioned structure payload', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);
    const graph = buildStructureGraph(tree, 2);
    const payload = createStructureGraphPayload(graph, {
      generatedBy: GENERATED_BY,
      scannedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(payload).toMatchObject({
      schemaVersion: GRAPH_PAYLOAD_SCHEMA_VERSION,
      mode: 'structure',
      generatedBy: GENERATED_BY,
      totalFiles: graph.nodes.filter((node) => node.kind === 'file').length,
      totalDirs: graph.nodes.filter((node) => node.kind === 'directory').length,
    });
    expect(() => assertExplorerGraphData(payload)).not.toThrow();
  });

  it('creates dependency payloads with graph health metadata', async () => {
    const scan = await scanProject({ rootDir: SIMPLE_PROJECT });
    const payload = createDependencyGraphPayload(scan, { generatedBy: GENERATED_BY });

    expect(payload.mode).toBe('dependencies');
    expect(payload.nodes).toHaveLength(scan.graph.nodes.length);
    expect(payload.edges).toHaveLength(scan.graph.edges.length);
    expect(payload.healthScore?.score).toBeGreaterThanOrEqual(0);
    expect(() => assertExplorerGraphData(payload)).not.toThrow();
  });

  it('rejects incompatible graph data before consumers render it', () => {
    expect(() => assertExplorerGraphData({
      schemaVersion: '2.0.0',
      mode: 'dependencies',
      nodes: [],
      edges: [],
    })).toThrow(/Unsupported depxray graph schema/);

    expect(() => assertExplorerGraphSet({
      schemaVersion: GRAPH_PAYLOAD_SCHEMA_VERSION,
      availableModes: ['dependencies'],
      defaultMode: 'dependencies',
      graphs: {
        dependencies: { schemaVersion: '0.1.0' },
      },
    })).toThrow(/Unsupported depxray graph schema/);
  });
});
