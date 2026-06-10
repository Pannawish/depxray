import {
  buildStructureGraph,
  scanFileTree,
  scanProject,
} from '@depxray/core';
import type { GraphMode } from './shared.js';
import {
  resolveRootDir,
  toDependencyGraphData,
  toStructureGraphData,
} from './shared.js';

export interface ScanProjectInput {
  rootDir: string;
  mode?: GraphMode;
}

export async function scanProjectTool(input: ScanProjectInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const mode = input.mode ?? 'dependencies';

  if (mode === 'structure') {
    const tree = await scanFileTree(rootDir);
    return toStructureGraphData(buildStructureGraph(tree));
  }

  const result = await scanProject({ rootDir, detectCircular: true });
  return toDependencyGraphData(result);
}
