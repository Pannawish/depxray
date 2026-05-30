import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { scanFileTree } from '../src/scanFileTree.js';
import { buildStructureGraph } from '../src/buildStructureGraph.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');

describe('buildStructureGraph', () => {
  it('should build parent-child graph nodes and edges from the file tree', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);
    const graph = buildStructureGraph(tree, 2);

    expect(graph.rootDir).toBe(path.resolve(SIMPLE_PROJECT));
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBe(graph.nodes.length - 1);

    const rootNode = graph.nodes.find((node) => node.relativePath === '.');
    expect(rootNode?.label).toBe(path.basename(SIMPLE_PROJECT));
    expect(rootNode?.childCount).toBe(2);

    const srcNode = graph.nodes.find((node) => node.relativePath === 'src');
    expect(srcNode?.kind).toBe('directory');
    expect(srcNode?.descendantCount).toBe(5);
  });

  it('should omit deeper descendants beyond the requested depth', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);
    const graph = buildStructureGraph(tree, 1);

    expect(graph.nodes.some((node) => node.relativePath === 'src/components')).toBe(false);
    expect(graph.nodes.some((node) => node.relativePath === 'src')).toBe(true);
  });
});
