import { resolveRootDir, scanProject } from './shared.js';

export interface FindOrphansInput {
  rootDir: string;
  entryPointPatterns?: string[];
}

export async function findOrphansTool(input: FindOrphansInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const result = await scanProject({
    rootDir,
    detectCircular: true,
    entryPointPatterns: input.entryPointPatterns,
  });

  return {
    count: result.orphanFiles.length,
    orphanFiles: result.orphanFiles,
  };
}
