import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectProjectEntryPointPatterns } from '../src/detectProjectEntryPoints.js';
import { scanProject } from '../src/scanProject.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('framework-aware entry points', () => {
  it('detects declared executables and framework-owned route files', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'depxray-entrypoints-'));
    temporaryDirectories.push(rootDir);
    await fs.mkdir(path.join(rootDir, 'src/app/dashboard'), { recursive: true });
    await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, 'package.json'),
      JSON.stringify({
        bin: { example: './src/cli.ts' },
        dependencies: { next: '15.0.0' },
      }),
    );
    await fs.writeFile(path.join(rootDir, 'src/cli.ts'), 'export const run = true;\n');
    await fs.writeFile(
      path.join(rootDir, 'src/app/dashboard/page.tsx'),
      'export default function Page() {}\n',
    );

    const patterns = await detectProjectEntryPointPatterns(rootDir);
    expect(patterns).toContain('src/cli.ts');
    expect(patterns).toContain('**/app/**/page.*');

    const result = await scanProject({ rootDir });
    expect(result.orphanFiles).toEqual([]);
  });
});
