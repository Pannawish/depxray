// ============================================================================
// Mermaid Formatter - Markdown-friendly dependency graph output
// ============================================================================

import type { ScanResult } from '@depxray/core';

function escapeMermaidLabel(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\n/g, ' ');
}

function nodeId(index: number): string {
  return `N${index}`;
}

export function formatAsMermaid(result: ScanResult): string {
  const { graph } = result;
  const nodeIds = new Map<string, string>();
  const lines: string[] = ['flowchart LR'];

  graph.nodes.forEach((node, index) => {
    const id = nodeId(index);
    nodeIds.set(node.id, id);
    const workspace = node.workspace ? ` (${node.workspace})` : '';
    lines.push(`  ${id}["${escapeMermaidLabel(node.relativePath + workspace)}"]`);
  });

  if (graph.nodes.length > 0 && graph.edges.length > 0) {
    lines.push('');
  }

  for (const edge of graph.edges) {
    const sourceId = nodeIds.get(edge.source);
    const targetId = nodeIds.get(edge.target);
    if (!sourceId || !targetId) {
      continue;
    }

    const arrow = edge.isTypeOnly || edge.isCrossPackage ? '-.->' : '-->';
    const label = edge.isDynamic
      ? '|dynamic|'
      : edge.isCrossPackage
        ? '|cross-package|'
        : '';
    lines.push(`  ${sourceId} ${arrow}${label} ${targetId}`);
  }

  const circularNodeIds = graph.nodes
    .filter((node) => node.isCircular)
    .map((node) => nodeIds.get(node.id))
    .filter((id): id is string => Boolean(id));
  const workspaceNodeIds = graph.nodes
    .filter((node) => node.workspace && !node.isCircular)
    .map((node) => nodeIds.get(node.id))
    .filter((id): id is string => Boolean(id));

  if (circularNodeIds.length > 0 || workspaceNodeIds.length > 0) {
    lines.push('');
    lines.push('  classDef circular fill:#fee2e2,stroke:#b91c1c,color:#111827;');
    lines.push('  classDef workspace fill:#dbeafe,stroke:#2563eb,color:#111827;');
  }

  if (circularNodeIds.length > 0) {
    lines.push(`  class ${circularNodeIds.join(',')} circular;`);
  }

  if (workspaceNodeIds.length > 0) {
    lines.push(`  class ${workspaceNodeIds.join(',')} workspace;`);
  }

  return lines.join('\n');
}
