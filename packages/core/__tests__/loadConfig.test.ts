import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/loadConfig.js';

let tempDir: string;

async function writeFile(relativePath: string, content: string): Promise<void> {
  const filePath = path.join(tempDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('loadConfig', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'depxray-config-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns an empty config when no config exists', async () => {
    await expect(loadConfig(tempDir)).resolves.toEqual({});
  });

  it('loads depxray.config.js', async () => {
    await writeFile(
      'depxray.config.js',
      'module.exports = { ignore: ["fixtures"], mode: "dependencies", circular: false, port: 6000, depth: "all" };\n',
    );

    await expect(loadConfig(tempDir)).resolves.toEqual({
      ignore: ['fixtures'],
      extensions: undefined,
      entryPoints: undefined,
      mode: 'dependencies',
      circular: false,
      aliases: undefined,
      port: 6000,
      depth: 'all',
    });
  });

  it('loads depxray.config.mjs', async () => {
    await writeFile(
      'depxray.config.mjs',
      'export default { extensions: [".ts"], entryPoints: ["src/main.ts"], aliases: false, depth: 3 };\n',
    );

    const config = await loadConfig(tempDir);
    expect(config.extensions).toEqual(['.ts']);
    expect(config.entryPoints).toEqual(['src/main.ts']);
    expect(config.aliases).toBe(false);
    expect(config.depth).toBe(3);
  });

  it('loads .depxrayrc.json', async () => {
    await writeFile('.depxrayrc.json', JSON.stringify({ mode: 'structure', ignore: ['dist'] }));

    const config = await loadConfig(tempDir);
    expect(config.mode).toBe('structure');
    expect(config.ignore).toEqual(['dist']);
  });

  it('loads architecture rules', async () => {
    await writeFile(
      '.depxrayrc.json',
      JSON.stringify({
        rules: [
          {
            from: 'src/ui/**',
            to: 'src/db/**',
            severity: 'warning',
            message: 'UI should not import DB',
          },
        ],
      }),
    );

    const config = await loadConfig(tempDir);
    expect(config.rules).toEqual([
      {
        from: 'src/ui/**',
        to: 'src/db/**',
        severity: 'warning',
        message: 'UI should not import DB',
      },
    ]);
  });

  it('loads plugin references', async () => {
    await writeFile(
      '.depxrayrc.json',
      JSON.stringify({
        plugins: ['@depxray/plugin-complexity', './depxray-plugin.mjs'],
      }),
    );

    const config = await loadConfig(tempDir);
    expect(config.plugins).toEqual(['@depxray/plugin-complexity', './depxray-plugin.mjs']);
  });

  it('loads the depxray key from package.json', async () => {
    await writeFile(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        depxray: {
          mode: 'dependencies',
          extensions: ['.tsx'],
        },
      }),
    );

    const config = await loadConfig(tempDir);
    expect(config.mode).toBe('dependencies');
    expect(config.extensions).toEqual(['.tsx']);
  });

  it('uses file config before package.json config', async () => {
    await writeFile('depxray.config.js', 'module.exports = { mode: "dependencies" };\n');
    await writeFile('package.json', JSON.stringify({ depxray: { mode: 'structure' } }));

    const config = await loadConfig(tempDir);
    expect(config.mode).toBe('dependencies');
  });

  it('throws a clear error for invalid values', async () => {
    await writeFile('.depxrayrc.json', JSON.stringify({ mode: 'invalid' }));

    await expect(loadConfig(tempDir)).rejects.toThrow(
      'Invalid depxray config in .depxrayrc.json: mode must be "structure" or "dependencies".',
    );
  });
});
