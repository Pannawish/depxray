import { resolveRootDir, scanProject } from './shared.js';

export interface FindCircularInput {
  rootDir: string;
}

export async function findCircularTool(input: FindCircularInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const result = await scanProject({ rootDir, detectCircular: true });

  return {
    count: result.graph.circularDependencies.length,
    chains: result.graph.circularDependencies,
  };
}
