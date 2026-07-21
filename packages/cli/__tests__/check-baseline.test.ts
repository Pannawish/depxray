import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanProject } from '@depxray/core';
import { compareCheckResults } from '../src/checkBaseline.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

async function createProject(source: string): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'depxray-baseline-test-'));
  temporaryDirectories.push(rootDir);
  await fs.mkdir(path.join(rootDir, 'src'));
  await fs.writeFile(path.join(rootDir, 'src/index.ts'), source);
  return rootDir;
}

describe('check baseline comparison', () => {
  it('separates inherited findings from newly introduced findings', async () => {
    const baselineRoot = await createProject(
      "import './existing-missing';\nexport const value = 1;\n",
    );
    const currentRoot = await createProject(
      "import './existing-missing';\nimport './new-missing';\nexport const value = 1;\n",
    );
    const [baseline, current] = await Promise.all([
      scanProject({ rootDir: baselineRoot }),
      scanProject({ rootDir: currentRoot }),
    ]);

    const comparison = compareCheckResults(baseline, current);
    expect(comparison.newIssueCount).toBe(1);
    expect(comparison.newIssues.unresolvedImports).toEqual(['src/index.ts:2:./new-missing']);
    expect(comparison.resolvedIssueCount).toBe(0);
  });
});
