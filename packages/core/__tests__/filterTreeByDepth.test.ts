import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { scanFileTree } from '../src/scanFileTree.js';
import { filterTreeByDepth } from '../src/filterTreeByDepth.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');

describe('filterTreeByDepth', () => {
  it('should keep nodes up to the requested depth and truncate deeper directories', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);
    const filtered = filterTreeByDepth(tree, 1);
    const srcNode = filtered.children.find((child) => child.name === 'src');

    expect(filtered.children).toHaveLength(2);
    expect(srcNode?.children).toEqual([]);
  });

  it('should return a clone for unbounded depth', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);
    const filtered = filterTreeByDepth(tree, Infinity);

    expect(filtered).toEqual(tree);
    expect(filtered).not.toBe(tree);
  });
});
