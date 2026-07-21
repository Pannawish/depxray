import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  diffGraphs,
} from '@depxray/core';
import { resolveRootDir, scanProject } from './shared.js';

export interface DiffGraphsInput {
  rootDir: string;
  baseRef: string;
}

export async function diffGraphsTool(input: DiffGraphsInput) {
  const rootDir = resolveRootDir(input.rootDir);
  const currentResult = await scanProject({ rootDir, detectCircular: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'depxray-diff-'));
  const archivePath = path.join(tmpDir, 'base.tar');
  const checkoutDir = path.join(tmpDir, 'checkout');

  try {
    fs.mkdirSync(checkoutDir);
    execFileSync('git', ['-C', rootDir, 'archive', '--format=tar', '--output', archivePath, input.baseRef], {
      stdio: 'pipe',
    });
    execFileSync('tar', ['-xf', archivePath, '-C', checkoutDir], {
      stdio: 'pipe',
    });
    const baseResult = await scanProject({ rootDir: checkoutDir, detectCircular: true });
    return diffGraphs(baseResult.graph, currentResult.graph);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
