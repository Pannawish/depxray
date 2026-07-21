import {
  type UnusedExport,
} from '@depxray/core';
import {
  assertPathInsideRoot,
  resolveProjectPath,
  resolveRootDir,
  scanProject,
} from './shared.js';

export interface FindUnusedExportsInput {
  rootDir: string;
  filePath?: string;
}

export interface UnusedExportEntry {
  file: string;
  exportName: string;
  kind: UnusedExport['kind'];
  isTypeOnly: boolean;
  line: number;
}

export async function findUnusedExportsTool(input: FindUnusedExportsInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const result = await scanProject({ rootDir, detectCircular: false });
  const targetPath = input.filePath
    ? resolveProjectPath(rootDir, input.filePath)
    : null;
  if (targetPath) {
    assertPathInsideRoot(rootDir, targetPath);
  }

  const entries: UnusedExportEntry[] = [];
  for (const node of result.graph.nodes) {
    if (!node.unusedExports?.length) {
      continue;
    }
    if (targetPath && node.id !== targetPath) {
      continue;
    }

    for (const unusedExport of node.unusedExports) {
      entries.push({
        file: node.relativePath,
        exportName: unusedExport.name,
        kind: unusedExport.kind,
        isTypeOnly: unusedExport.isTypeOnly,
        line: unusedExport.line,
      });
    }
  }

  return {
    count: entries.length,
    unusedExports: entries,
  };
}
