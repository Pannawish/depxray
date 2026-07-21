import { computeHealthScore } from '@depxray/core';
import { resolveRootDir, scanProject } from './shared.js';

export interface CheckHealthInput {
  rootDir: string;
}

export async function checkHealthTool(input: CheckHealthInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const result = await scanProject({ rootDir, detectCircular: true });
  return computeHealthScore(result);
}
