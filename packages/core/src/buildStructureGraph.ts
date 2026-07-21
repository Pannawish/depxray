import type {
  FileTreeNode,
  StructureGraph,
  StructureGraphEdge,
  StructureGraphNode,
} from './types.js';
import { filterTreeByDepth } from './filterTreeByDepth.js';

function countDescendants(node: FileTreeNode): number {
  return node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
}

export function buildStructureGraph(
  rootNode: FileTreeNode,
  maxDepth: number = Infinity,
): StructureGraph {
  const nodes: StructureGraphNode[] = [];
  const edges: StructureGraphEdge[] = [];
  const visibleTree = filterTreeByDepth(rootNode, maxDepth);

  function visit(node: FileTreeNode, parentId: string | null): void {
    nodes.push({
      id: node.id,
      label: node.name,
      relativePath: node.relativePath,
      absolutePath: node.absolutePath,
      kind: node.kind,
      extension: node.extension,
      depth: node.depth,
      collapsed: false,
      hidden: false,
      childCount: node.children.length,
      descendantCount: countDescendants(node),
      ...(node.sizeBytes !== undefined ? { sizeBytes: node.sizeBytes } : {}),
    });

    if (parentId) {
      edges.push({
        id: `${parentId}->${node.id}`,
        source: parentId,
        target: node.id,
      });
    }

    for (const child of node.children) {
      visit(child, node.id);
    }
  }

  visit(visibleTree, null);

  return {
    rootDir: rootNode.absolutePath,
    nodes,
    edges,
  };
}
