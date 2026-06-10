import { scanFileTree } from '@depxray/core';
import { resolveRootDir } from './shared.js';

export interface GetFileTreeInput {
  rootDir: string;
  maxDepth?: number;
}

export async function getFileTreeTool(input: GetFileTreeInput) {
  return scanFileTree(resolveRootDir(input.rootDir), {
    maxDepth: input.maxDepth ?? Infinity,
  });
}
