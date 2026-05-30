import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { scanFileTree } from '../src/scanFileTree.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');

describe('scanFileTree', () => {
  it('should scan directories and files into a rooted tree', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);

    expect(tree.kind).toBe('directory');
    expect(tree.relativePath).toBe('.');
    expect(tree.depth).toBe(0);
    expect(tree.children.map((child) => child.name)).toEqual(['src', 'tsconfig.json']);

    const srcNode = tree.children.find((child) => child.name === 'src');
    expect(srcNode?.kind).toBe('directory');
    expect(srcNode?.depth).toBe(1);

    const tsconfigNode = tree.children.find((child) => child.name === 'tsconfig.json');
    expect(tsconfigNode?.kind).toBe('file');
    expect(tsconfigNode?.sizeBytes).toBeGreaterThan(0);
  });

  it('should respect maxDepth by truncating deeper children', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT, { maxDepth: 1 });
    const srcNode = tree.children.find((child) => child.name === 'src');

    expect(srcNode?.children).toEqual([]);
  });

  it('should respect ignore patterns', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT, { ignorePatterns: ['pages'] });
    const srcNode = tree.children.find((child) => child.name === 'src');
    const pagesNode = srcNode?.children.find((child) => child.name === 'pages');

    expect(pagesNode).toBeUndefined();
  });
});
