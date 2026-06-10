import * as path from 'node:path';
import { createRequire } from 'node:module';
import type {
  FileTreeNode,
  ScanError,
  ScanResult,
  StructureGraph,
  StructureGraphEdge,
  StructureGraphNode,
} from '@depxray/core';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

export type GraphMode = 'structure' | 'dependencies';

export interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  componentName?: string;
}

export interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: GraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
}

export interface ExplorerGraphData {
  schemaVersion: string;
  mode: GraphMode;
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  orphanFiles: string[];
  generatedBy: string;
  errors: ScanError[];
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

const EXPORT_SCHEMA_VERSION = '1.0.0';

export function resolveRootDir(rootDir: string): string {
  return path.resolve(rootDir);
}

export function resolveProjectPath(rootDir: string, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(rootDir, targetPath);
}

export function assertPathInsideRoot(rootDir: string, targetPath: string): void {
  const relative = path.relative(rootDir, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path is outside project root: ${targetPath}`);
  }
}

export function jsonContent(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function getGeneratedBy(): string {
  return `@depxray/mcp@${packageJson.version}`;
}

export function toStructureGraphData(graph: StructureGraph): ExplorerGraphData {
  const scannedAt = new Date().toISOString();
  const totalFiles = graph.nodes.filter((node) => node.kind === 'file').length;
  const totalDirs = graph.nodes.filter((node) => node.kind === 'directory').length;

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    mode: 'structure',
    projectRoot: graph.rootDir,
    scannedAt,
    totalFiles,
    totalDirs,
    totalImports: 0,
    circularCount: 0,
    orphanFiles: [],
    generatedBy: getGeneratedBy(),
    errors: [],
    nodes: graph.nodes,
    edges: graph.edges.map((edge) => ({
      ...edge,
      kind: 'structure',
    })),
  };
}

export function toDependencyGraphData(result: ScanResult): ExplorerGraphData {
  const orphanFileSet = new Set(result.orphanFiles);
  const nodes: ExplorerGraphNode[] = result.graph.nodes.map((node) => ({
    id: node.id,
    label: path.basename(node.relativePath),
    relativePath: node.relativePath,
    absolutePath: node.id,
    kind: 'file',
    extension: node.extension,
    depth: Math.max(1, node.relativePath.split(/[/\\]/).filter(Boolean).length),
    collapsed: false,
    hidden: false,
    childCount: node.outDegree,
    descendantCount: Math.max(node.inDegree, node.outDegree),
    inDegree: node.inDegree,
    outDegree: node.outDegree,
    isCircular: node.isCircular,
    isOrphan: orphanFileSet.has(node.relativePath),
    ...(node.componentName ? { componentName: node.componentName } : {}),
  }));

  const edges: ExplorerGraphEdge[] = result.graph.edges.map((edge, index) => ({
    id: `${edge.source}->${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    kind: 'dependencies',
    importSpecifier: edge.importSpecifier,
    importedNames: edge.importedNames,
    isTypeOnly: edge.isTypeOnly,
    isDynamic: edge.isDynamic,
  }));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    mode: 'dependencies',
    projectRoot: result.graph.rootDir,
    scannedAt: result.graph.metadata.scannedAt,
    totalFiles: result.totalFiles,
    totalDirs: 0,
    totalImports: result.totalImports,
    circularCount: result.circularCount,
    orphanFiles: result.orphanFiles,
    generatedBy: getGeneratedBy(),
    errors: result.errors,
    nodes,
    edges,
  };
}

export function flattenTree(rootNode: FileTreeNode): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];

  function visit(node: FileTreeNode): void {
    nodes.push(node);
    for (const child of node.children) {
      visit(child);
    }
  }

  visit(rootNode);
  return nodes;
}
