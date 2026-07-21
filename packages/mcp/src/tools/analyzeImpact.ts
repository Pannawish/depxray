import {
  analyzeImpact,
} from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
  scanProject,
} from './shared.js';

export interface AnalyzeImpactInput {
  rootDir?: string;
  filePath: string;
  complexityThreshold?: number;
  impactThreshold?: number;
  inboundThreshold?: number;
}

export async function analyzeImpactTool(input: AnalyzeImpactInput) {
  const rootDir = resolveRootDir(input.rootDir ?? process.cwd());
  const filePath = resolveProjectPath(rootDir, input.filePath);
  assertPathInsideRoot(rootDir, filePath);

  const result = await scanProject({ rootDir, detectCircular: true });

  return analyzeImpact(result.graph, filePath, {
    complexityThreshold: input.complexityThreshold,
    impactThreshold: input.impactThreshold,
    inboundThreshold: input.inboundThreshold,
  });
}
