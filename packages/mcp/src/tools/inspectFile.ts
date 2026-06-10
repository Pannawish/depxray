import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { scanProject } from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
} from './shared.js';

export interface InspectFileInput {
  filePath: string;
  rootDir?: string;
}

export async function inspectFileTool(input: InspectFileInput) {
  const rootDir = resolveRootDir(input.rootDir ?? process.cwd());
  const filePath = resolveProjectPath(rootDir, input.filePath);
  assertPathInsideRoot(rootDir, filePath);

  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  const result = await scanProject({ rootDir, detectCircular: true });
  const node = result.graph.nodes.find((graphNode) => graphNode.id === filePath);
  if (!node) {
    throw new Error(`File not found in dependency graph: ${input.filePath}`);
  }

  const imports = result.graph.edges.filter((edge) => edge.source === filePath);
  const dependents = result.graph.edges.filter((edge) => edge.target === filePath);

  return {
    file: node.relativePath,
    absolutePath: node.id,
    extension: node.extension,
    inDegree: node.inDegree,
    outDegree: node.outDegree,
    isCircular: node.isCircular,
    isOrphan: result.orphanFiles.includes(node.relativePath),
    metrics: node.metrics,
    imports: imports.map((edge) => ({
      file: path.relative(rootDir, edge.target),
      absolutePath: edge.target,
      specifier: edge.importSpecifier,
      names: edge.importedNames,
      isTypeOnly: edge.isTypeOnly,
      isDynamic: edge.isDynamic,
    })),
    dependents: dependents.map((edge) => ({
      file: path.relative(rootDir, edge.source),
      absolutePath: edge.source,
      specifier: edge.importSpecifier,
      names: edge.importedNames,
      isTypeOnly: edge.isTypeOnly,
      isDynamic: edge.isDynamic,
    })),
  };
}
