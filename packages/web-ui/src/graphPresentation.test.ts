import { describe, expect, it } from 'vitest';
import { getStableGraphPositions } from './graphLayout.js';
import { getSemanticLabelSize, shouldShowSemanticLabel } from './components/forceGraphRendering.js';
import type { ExplorerGraphNode } from './types.js';
import type { ForceGraphNode } from './components/forceGraphModel.js';

function graphNode(id: string, scopeRole: ExplorerGraphNode['scopeRole']): ExplorerGraphNode {
  return {
    id,
    label: id,
    relativePath: id,
    absolutePath: `/${id}`,
    kind: 'file',
    extension: '.ts',
    depth: 1,
    collapsed: false,
    hidden: false,
    childCount: 0,
    descendantCount: 0,
    scopeRole,
  };
}

describe('graph presentation', () => {
  it('places file relationships into deterministic left-to-right columns', () => {
    const nodes = [
      graphNode('dependency', 'import'),
      graphNode('selected', 'focus'),
      graphNode('dependent', 'dependent'),
    ];

    const first = getStableGraphPositions(nodes, 'file');
    const second = getStableGraphPositions([...nodes].reverse(), 'file');

    expect(first.get('dependent')?.x).toBe(-240);
    expect(first.get('selected')?.x).toBe(0);
    expect(first.get('dependency')?.x).toBe(240);
    expect(second).toEqual(first);
  });

  it('reduces on-screen label size as the user zooms in', () => {
    const zoomedOut = getSemanticLabelSize(0.5, false) * 0.5;
    const normal = getSemanticLabelSize(1, false);
    const zoomedIn = getSemanticLabelSize(3, false) * 3;

    expect(zoomedOut).toBe(12);
    expect(normal).toBe(10.5);
    expect(zoomedIn).toBeCloseTo(8.5);
    expect(zoomedOut).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(zoomedIn);
  });

  it('keeps only important labels visible in a zoomed-out smart view', () => {
    const ordinary = graphNode('ordinary', 'import') as ForceGraphNode;
    const hub = { ...ordinary, id: 'hub', isHub: true };
    const folder = { ...ordinary, id: 'folder', kind: 'directory' as const };

    expect(shouldShowSemanticLabel(ordinary, 0.5, null, null, 'smart')).toBe(false);
    expect(shouldShowSemanticLabel(hub, 0.5, null, null, 'smart')).toBe(true);
    expect(shouldShowSemanticLabel(folder, 0.5, null, null, 'smart')).toBe(true);
    expect(shouldShowSemanticLabel(ordinary, 2, null, null, 'smart')).toBe(true);
  });
});
