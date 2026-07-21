import { describe, expect, it } from 'vitest';
import { diffGraphs } from '../src/diffGraphs.js';

describe('diffGraphs', () => {
  it('diffs files, edges, and circular dependencies', () => {
    const before = {
      projectRoot: '/project',
      nodes: [
        { id: '/project/src/App.ts', relativePath: 'src/App.ts' },
        { id: '/project/src/old.ts', relativePath: 'src/old.ts' },
      ],
      edges: [
        {
          source: '/project/src/App.ts',
          target: '/project/src/old.ts',
          importSpecifier: './old',
        },
      ],
      circularDependencies: [{ description: 'src/App.ts -> src/old.ts -> src/App.ts' }],
    };
    const after = {
      projectRoot: '/project',
      nodes: [
        { id: '/project/src/App.ts', relativePath: 'src/App.ts' },
        { id: '/project/src/new.ts', relativePath: 'src/new.ts' },
      ],
      edges: [
        {
          source: '/project/src/App.ts',
          target: '/project/src/new.ts',
          importSpecifier: './new',
        },
      ],
      circularDependencies: [{ description: 'src/App.ts -> src/new.ts -> src/App.ts' }],
    };

    expect(diffGraphs(before, after)).toEqual({
      addedFiles: ['src/new.ts'],
      removedFiles: ['src/old.ts'],
      addedEdges: [
        {
          source: 'src/App.ts',
          target: 'src/new.ts',
          importSpecifier: './new',
        },
      ],
      removedEdges: [
        {
          source: 'src/App.ts',
          target: 'src/old.ts',
          importSpecifier: './old',
        },
      ],
      addedCircularDependencies: ['src/App.ts -> src/new.ts -> src/App.ts'],
      removedCircularDependencies: ['src/App.ts -> src/old.ts -> src/App.ts'],
    });
  });
});
