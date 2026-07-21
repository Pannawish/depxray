/** A single node in the scanned folder/file tree. */
export interface FileTreeNode {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  kind: 'file' | 'directory';
  extension: string | null;
  depth: number;
  children: FileTreeNode[];
  sizeBytes?: number;
}

/** A node in the structure graph used by the browser UI. */
export interface StructureGraphNode {
  id: string;
  label: string;
  relativePath: string;
  absolutePath: string;
  kind: 'file' | 'directory';
  extension: string | null;
  depth: number;
  collapsed: boolean;
  hidden: boolean;
  childCount: number;
  descendantCount: number;
  sizeBytes?: number;
}

/** A directed edge from a parent node to its child in the file tree. */
export interface StructureGraphEdge {
  id: string;
  source: string;
  target: string;
}

/** The structure graph payload produced from a file tree. */
export interface StructureGraph {
  rootDir: string;
  nodes: StructureGraphNode[];
  edges: StructureGraphEdge[];
}
