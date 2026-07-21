import type { ExplorerGraphNode, GraphScopeMode } from './types.js';

export interface GraphPosition {
  x: number;
  y: number;
}

function verticalPositions(nodes: ExplorerGraphNode[], x: number): Map<string, GraphPosition> {
  const sorted = [...nodes].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const spacing = Math.max(24, Math.min(54, 440 / Math.max(1, sorted.length)));
  const startY = -((sorted.length - 1) * spacing) / 2;
  return new Map(sorted.map((node, index) => [node.id, { x, y: startY + index * spacing }]));
}

function addAll(target: Map<string, GraphPosition>, source: Map<string, GraphPosition>): void {
  source.forEach((position, id) => target.set(id, position));
}

export function getStableGraphPositions(
  nodes: ExplorerGraphNode[],
  scopeMode: GraphScopeMode,
): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>();

  if (scopeMode === 'file') {
    addAll(
      positions,
      verticalPositions(
        nodes.filter(
          (node) => node.scopeRole === 'dependent' || node.scopeRole === 'external-incoming',
        ),
        -240,
      ),
    );
    addAll(
      positions,
      verticalPositions(
        nodes.filter((node) => node.scopeRole === 'focus' || node.scopeRole === 'related'),
        0,
      ),
    );
    addAll(
      positions,
      verticalPositions(
        nodes.filter(
          (node) => node.scopeRole === 'import' || node.scopeRole === 'external-outgoing',
        ),
        240,
      ),
    );
    return positions;
  }

  if (scopeMode === 'folder') {
    addAll(
      positions,
      verticalPositions(
        nodes.filter((node) =>
          ['external-incoming', 'external-both'].includes(node.scopeRole ?? ''),
        ),
        -250,
      ),
    );
    const centerNodes = nodes.filter(
      (node) => node.scopeRole === 'focus' || node.scopeRole === 'internal',
    );
    const focus = centerNodes.find((node) => node.scopeRole === 'focus');
    if (focus) positions.set(focus.id, { x: 0, y: 0 });
    const internalNodes = centerNodes.filter((node) => node.id !== focus?.id);
    internalNodes
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .forEach((node, index) => {
        const angle = (index / Math.max(1, internalNodes.length)) * Math.PI * 2 - Math.PI / 2;
        const radius = Math.max(70, Math.min(160, 50 + internalNodes.length * 7));
        positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
    addAll(
      positions,
      verticalPositions(
        nodes.filter((node) => ['external-outgoing'].includes(node.scopeRole ?? '')),
        250,
      ),
    );
    return positions;
  }

  const focus = nodes.find((node) => node.scopeRole === 'focus');
  if (focus) positions.set(focus.id, { x: 0, y: 0 });
  const surrounding = [...nodes]
    .filter((node) => node.id !== focus?.id)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const radius = Math.max(130, Math.min(360, 100 + surrounding.length * 8));
  surrounding.forEach((node, index) => {
    const angle = (index / Math.max(1, surrounding.length)) * Math.PI * 2 - Math.PI / 2;
    positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return positions;
}
