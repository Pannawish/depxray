import type { FileTreeNode } from './types.js';

export function filterTreeByDepth(rootNode: FileTreeNode, maxDepth: number): FileTreeNode {
  if (!Number.isFinite(maxDepth)) {
    return structuredClone(rootNode);
  }

  function truncate(node: FileTreeNode): FileTreeNode {
    if (node.kind === 'directory' && node.depth >= maxDepth) {
      return {
        ...node,
        children: [],
      };
    }

    return {
      ...node,
      children: node.children.map(truncate),
    };
  }

  return truncate(rootNode);
}
