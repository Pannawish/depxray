import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
  scanProject,
} from './shared.js';

export interface FindRelatedFilesInput {
  rootDir?: string;
  filePath: string;
}

export async function findRelatedFilesTool(input: FindRelatedFilesInput) {
  const rootDir = resolveRootDir(input.rootDir ?? process.cwd());
  const filePath = resolveProjectPath(rootDir, input.filePath);
  assertPathInsideRoot(rootDir, filePath);

  const result = await scanProject({ rootDir, detectCircular: false });
  const node = result.graph.nodes.find((item) => item.id === filePath);
  if (!node) {
    throw new Error(`File not found in dependency graph: ${input.filePath}`);
  }

  const imports = result.graph.edges
    .filter((edge) => edge.source === filePath)
    .map((edge) => path.relative(rootDir, edge.target).replaceAll('\\', '/'))
    .sort((a, b) => a.localeCompare(b));
  const dependents = result.graph.edges
    .filter((edge) => edge.target === filePath)
    .map((edge) => path.relative(rootDir, edge.source).replaceAll('\\', '/'))
    .sort((a, b) => a.localeCompare(b));
  const dir = path.dirname(filePath);
  let siblings: string[] = [];

  try {
    const entries = await fs.readdir(dir);
    siblings = entries
      .map((entry) => path.join(dir, entry))
      .filter((entryPath) => entryPath !== filePath)
      .map((entryPath) => path.relative(rootDir, entryPath).replaceAll('\\', '/'))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    siblings = [];
  }

  const basename = path.basename(filePath).replace(/\.[^.]+$/, '');
  const colocated = siblings.filter((sibling) => {
    const siblingBasename = path.basename(sibling).replace(/\.[^.]+$/, '');
    return siblingBasename.startsWith(basename) && sibling !== node.relativePath;
  });

  return {
    file: node.relativePath,
    imports,
    dependents,
    siblings,
    colocated,
  };
}
