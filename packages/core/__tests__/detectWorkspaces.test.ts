import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createWorkspaceAliases,
  detectWorkspaces,
  getWorkspaceForPath,
} from '../src/detectWorkspaces.js';

const TEMP_DIR = path.join(__dirname, 'tmp-workspace-detection');

describe('detectWorkspaces', () => {
  it('detects package.json workspaces and resolves files to the closest workspace', async () => {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    await fs.mkdir(path.join(TEMP_DIR, 'packages/app/src'), { recursive: true });
    await fs.mkdir(path.join(TEMP_DIR, 'packages/lib/src'), { recursive: true });
    await fs.writeFile(
      path.join(TEMP_DIR, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['packages/*'] }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(TEMP_DIR, 'packages/app/package.json'),
      JSON.stringify({ name: '@repo/app' }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(TEMP_DIR, 'packages/lib/package.json'),
      JSON.stringify({ name: '@repo/lib' }),
      'utf-8',
    );

    try {
      const workspaces = await detectWorkspaces(TEMP_DIR);
      expect(workspaces.map((workspace) => workspace.name)).toEqual(['@repo/app', '@repo/lib']);
      expect(
        getWorkspaceForPath(path.join(TEMP_DIR, 'packages/app/src/index.ts'), workspaces)?.name,
      ).toBe('@repo/app');
      expect(createWorkspaceAliases(workspaces).map((alias) => alias.prefix)).toContain(
        '@repo/lib',
      );
      expect(createWorkspaceAliases(workspaces).map((alias) => alias.prefix)).toContain(
        '@repo/lib/',
      );
    } finally {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    }
  });
});
