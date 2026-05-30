// ============================================================================
// DOT Formatter — Graphviz DOT format for the dependency graph
// ============================================================================
// Produces output that can be piped to `dot` for SVG/PNG rendering:
//   depxray scan --format dot | dot -Tsvg -o graph.svg
//   depxray scan --format dot | dot -Tpng -o graph.png
//
// Also viewable in online Graphviz editors like https://dreampuf.github.io/GraphvizOnline
// ============================================================================

import type { ScanResult } from '@depxray/core';

/**
 * Escape a string for use in DOT labels.
 */
function escapeLabel(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Get a color for a file based on its extension.
 */
function getNodeColor(extension: string): string {
  switch (extension) {
    case '.tsx':
      return '#61DAFB'; // React blue
    case '.jsx':
      return '#F7DF1E'; // JS yellow
    case '.ts':
      return '#3178C6'; // TypeScript blue
    case '.js':
      return '#F7DF1E'; // JS yellow
    default:
      return '#999999';
  }
}

/**
 * Format a ScanResult as a Graphviz DOT graph.
 *
 * @param result - The scan result to format
 * @returns DOT format string
 *
 * @example
 * ```bash
 * depxray scan --format dot | dot -Tsvg -o deps.svg
 * depxray scan --format dot | dot -Tpng -o deps.png
 * ```
 */
export function formatAsDot(result: ScanResult): string {
  const { graph } = result;
  const lines: string[] = [];

  lines.push('digraph DependencyGraph {');
  lines.push('  // Graph settings');
  lines.push('  rankdir=LR;');
  lines.push('  bgcolor="#1a1a2e";');
  lines.push('  node [shape=box, style="filled,rounded", fontname="Inter, Helvetica, Arial", fontsize=10, fontcolor="white", margin="0.15,0.08"];');
  lines.push('  edge [color="#555577", arrowsize=0.7];');
  lines.push('');

  // ── Nodes ──────────────────────────────────────────────────────────
  lines.push('  // Nodes');
  for (const node of graph.nodes) {
    const color = node.isCircular ? '#FF4444' : getNodeColor(node.extension);
    const label = escapeLabel(node.relativePath);
    const penwidth = node.isCircular ? '2.0' : '1.0';

    lines.push(
      `  "${escapeLabel(node.id)}" [label="${label}", fillcolor="${color}", penwidth=${penwidth}];`,
    );
  }

  lines.push('');

  // ── Edges ──────────────────────────────────────────────────────────
  lines.push('  // Edges');
  for (const edge of graph.edges) {
    const color = edge.isTypeOnly
      ? '#666688'
      : edge.isDynamic
        ? '#FFaa00'
        : '#555577';
    const style = edge.isTypeOnly
      ? 'dashed'
      : edge.isDynamic
        ? 'dotted'
        : 'solid';

    lines.push(
      `  "${escapeLabel(edge.source)}" -> "${escapeLabel(edge.target)}" [color="${color}", style=${style}];`,
    );
  }

  lines.push('}');

  return lines.join('\n');
}
