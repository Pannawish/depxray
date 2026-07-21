import * as path from 'node:path';
import { scanFileTree } from '@depxray/core';
import {
  assertPathInsideRoot,
  flattenTree,
  resolveProjectPath,
  resolveRootDir,
  scanProject,
} from './shared.js';

export interface GetFolderSummaryInput {
  rootDir: string;
  folderPath: string;
}

export async function getFolderSummaryTool(input: GetFolderSummaryInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const folderAbsolutePath = resolveProjectPath(rootDir, input.folderPath);
  assertPathInsideRoot(rootDir, folderAbsolutePath);

  const [tree, result] = await Promise.all([
    scanFileTree(rootDir),
    scanProject({ rootDir, detectCircular: true }),
  ]);
  const allTreeNodes = flattenTree(tree);
  const folderNode = allTreeNodes.find((node) => node.absolutePath === folderAbsolutePath);

  if (!folderNode) {
    throw new Error(`Folder not found: ${input.folderPath}`);
  }
  if (folderNode.kind !== 'directory') {
    throw new Error(`Not a directory: ${input.folderPath}`);
  }

  const fileIds = new Set(
    result.graph.nodes
      .filter((node) => {
        const relative = path.relative(folderAbsolutePath, node.id);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
      })
      .map((node) => node.id),
  );

  const circularFiles = result.graph.nodes
    .filter((node) => fileIds.has(node.id) && node.isCircular)
    .map((node) => node.relativePath);
  const orphanFiles = result.graph.nodes
    .filter((node) => fileIds.has(node.id) && result.orphanFiles.includes(node.relativePath))
    .map((node) => node.relativePath);
  const internalImports = result.graph.edges.filter(
    (edge) => fileIds.has(edge.source) && fileIds.has(edge.target),
  );
  const incomingExternal = result.graph.edges.filter(
    (edge) => !fileIds.has(edge.source) && fileIds.has(edge.target),
  );
  const outgoingExternal = result.graph.edges.filter(
    (edge) => fileIds.has(edge.source) && !fileIds.has(edge.target),
  );

  return {
    folder: folderNode.relativePath,
    absolutePath: folderNode.absolutePath,
    directChildren: folderNode.children.length,
    descendants: flattenTree(folderNode).length - 1,
    totalFiles: fileIds.size,
    internalImports: internalImports.length,
    incomingExternalRefs: incomingExternal.length,
    outgoingExternalRefs: outgoingExternal.length,
    circularFiles,
    orphanFiles,
    incomingExternal: incomingExternal.map((edge) => ({
      source: path.relative(rootDir, edge.source),
      target: path.relative(rootDir, edge.target),
      specifier: edge.importSpecifier,
    })),
    outgoingExternal: outgoingExternal.map((edge) => ({
      source: path.relative(rootDir, edge.source),
      target: path.relative(rootDir, edge.target),
      specifier: edge.importSpecifier,
    })),
  };
}
