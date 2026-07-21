import {
  buildStructureGraph,
  scanFileTree,
} from '@depxray/core';
import type { GraphMode } from './shared.js';
import {
  resolveRootDir,
  scanProject,
  toDependencyGraphData,
  toStructureGraphData,
} from './shared.js';

export interface ScanProjectInput {
  rootDir: string;
  mode?: GraphMode;
  prodEntryPoints?: string[];
  devEntryPoints?: string[];
  ignoreTypeImports?: boolean;
  importConventions?: {
    prefer?: 'relative' | 'absolute';
    aliasPrefix?: string;
    root?: string;
  };
}

export async function scanProjectTool(input: ScanProjectInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const mode = input.mode ?? 'dependencies';

  if (mode === 'structure') {
    const tree = await scanFileTree(rootDir);
    return toStructureGraphData(buildStructureGraph(tree));
  }

  const result = await scanProject({
    rootDir,
    detectCircular: true,
    prodEntryPoints: input.prodEntryPoints,
    devEntryPoints: input.devEntryPoints,
    ignoreTypeImports: input.ignoreTypeImports,
    importConventions: input.importConventions,
  });
  return toDependencyGraphData(result);
}
