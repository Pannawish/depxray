import {
  findDependencyChain,
  scanProject,
} from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
} from './shared.js';

export interface ExplainDependencyChainInput {
  rootDir?: string;
  from: string;
  to: string;
}

export async function explainDependencyChainTool(input: ExplainDependencyChainInput) {
  const rootDir = resolveRootDir(input.rootDir ?? process.cwd());
  const fromPath = resolveProjectPath(rootDir, input.from);
  const toPath = resolveProjectPath(rootDir, input.to);
  assertPathInsideRoot(rootDir, fromPath);
  assertPathInsideRoot(rootDir, toPath);

  const result = await scanProject({ rootDir, detectCircular: false });
  return findDependencyChain(result.graph, fromPath, toPath);
}
