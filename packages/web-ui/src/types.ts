import type {
  StructureGraphEdge,
  StructureGraphNode,
} from '@rdg/core';

export type { StructureGraphEdge, StructureGraphNode } from '@rdg/core';

export type DepthFilter = 1 | 2 | 3 | 4 | 'all';

export interface StructureGraphData {
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  nodes: StructureGraphNode[];
  edges: StructureGraphEdge[];
}

declare global {
  interface Window {
    __GRAPH_DATA__?: StructureGraphData;
  }
}
