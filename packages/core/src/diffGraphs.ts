type SnapshotNode = {
  id?: string;
  relativePath?: string;
};

type SnapshotEdge = {
  source?: string;
  target?: string;
  importSpecifier?: string;
};

type SnapshotCircular = {
  chain?: string[];
  description?: string;
};

type GraphSnapshot = {
  projectRoot?: string;
  metadata?: {
    projectRoot?: string;
  };
  nodes?: SnapshotNode[];
  edges?: SnapshotEdge[];
  circularDependencies?: SnapshotCircular[];
};

export interface GraphDiffEdge {
  source: string;
  target: string;
  importSpecifier?: string;
}

export interface GraphDiffResult {
  addedFiles: string[];
  removedFiles: string[];
  addedEdges: GraphDiffEdge[];
  removedEdges: GraphDiffEdge[];
  addedCircularDependencies: string[];
  removedCircularDependencies: string[];
}

function rootDir(snapshot: GraphSnapshot): string | undefined {
  return snapshot.projectRoot ?? snapshot.metadata?.projectRoot;
}

function normalizePath(value: string | undefined, root: string | undefined): string {
  if (!value) {
    return '';
  }

  const normalizedValue = value.replaceAll('\\', '/');
  const normalizedRoot = root?.replaceAll('\\', '/').replace(/\/$/, '');
  if (normalizedRoot && normalizedValue.startsWith(`${normalizedRoot}/`)) {
    return normalizedValue.slice(normalizedRoot.length + 1);
  }

  return normalizedValue;
}

function nodePath(node: SnapshotNode, root: string | undefined): string {
  return normalizePath(node.relativePath ?? node.id, root);
}

function edgeKey(edge: GraphDiffEdge): string {
  return `${edge.source}->${edge.target}->${edge.importSpecifier ?? ''}`;
}

function normalizeEdges(snapshot: GraphSnapshot): GraphDiffEdge[] {
  const root = rootDir(snapshot);
  return (snapshot.edges ?? [])
    .map((edge) => ({
      source: normalizePath(edge.source, root),
      target: normalizePath(edge.target, root),
      ...(edge.importSpecifier ? { importSpecifier: edge.importSpecifier } : {}),
    }))
    .filter((edge) => edge.source && edge.target)
    .sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)));
}

function circularKey(circular: SnapshotCircular): string {
  if (circular.description) {
    return circular.description;
  }

  return (circular.chain ?? []).join(' -> ');
}

function difference<T>(before: T[], after: T[], key: (value: T) => string): T[] {
  const beforeKeys = new Set(before.map(key));
  return after.filter((value) => !beforeKeys.has(key(value)));
}

export function diffGraphs(
  beforeSnapshot: GraphSnapshot,
  afterSnapshot: GraphSnapshot,
): GraphDiffResult {
  const beforeRoot = rootDir(beforeSnapshot);
  const afterRoot = rootDir(afterSnapshot);
  const beforeFiles = (beforeSnapshot.nodes ?? [])
    .map((node) => nodePath(node, beforeRoot))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const afterFiles = (afterSnapshot.nodes ?? [])
    .map((node) => nodePath(node, afterRoot))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const beforeEdges = normalizeEdges(beforeSnapshot);
  const afterEdges = normalizeEdges(afterSnapshot);
  const beforeCircular = (beforeSnapshot.circularDependencies ?? [])
    .map(circularKey)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const afterCircular = (afterSnapshot.circularDependencies ?? [])
    .map(circularKey)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return {
    addedFiles: difference(beforeFiles, afterFiles, (value) => value),
    removedFiles: difference(afterFiles, beforeFiles, (value) => value),
    addedEdges: difference(beforeEdges, afterEdges, edgeKey),
    removedEdges: difference(afterEdges, beforeEdges, edgeKey),
    addedCircularDependencies: difference(beforeCircular, afterCircular, (value) => value),
    removedCircularDependencies: difference(afterCircular, beforeCircular, (value) => value),
  };
}
