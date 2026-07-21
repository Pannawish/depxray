import * as path from 'node:path';
import { createRequire } from 'node:module';
import {
  createDependencyGraphPayload,
  createStructureGraphPayload,
  ProjectScanSession,
} from '@depxray/core';
import type {
  ExplorerGraphData,
  ExplorerGraphMode,
  FileTreeNode,
  ScanResult,
  ScanOptions,
  StructureGraph,
} from '@depxray/core';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };
const MAX_SCAN_SESSIONS = 8;
const scanSessions = new Map<string, ProjectScanSession>();

export type GraphMode = ExplorerGraphMode;

export function scanProject(options: ScanOptions): Promise<ScanResult> {
  const rootDir = path.resolve(options.rootDir);
  let session = scanSessions.get(rootDir);
  if (!session) {
    session = new ProjectScanSession({ rootDir });
  } else {
    scanSessions.delete(rootDir);
  }
  scanSessions.set(rootDir, session);

  while (scanSessions.size > MAX_SCAN_SESSIONS) {
    const oldestRoot = scanSessions.keys().next().value as string | undefined;
    if (!oldestRoot) break;
    scanSessions.delete(oldestRoot);
  }

  const {
    rootDir: _rootDir,
    analysisCache: _analysisCache,
    ...overrides
  } = options;
  return session.scan(overrides);
}

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
  return createStructureGraphPayload(graph, { generatedBy: getGeneratedBy() });
}

export function toDependencyGraphData(result: ScanResult): ExplorerGraphData {
  return createDependencyGraphPayload(result, { generatedBy: getGeneratedBy() });
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
