import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectScanSession } from '../src/ProjectScanSession.js';

const SIMPLE_PROJECT = path.resolve(__dirname, 'fixtures/simple-project');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

describe('ProjectScanSession', () => {
  it('reuses unchanged syntax analysis and reparses only changed files', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'depxray-session-'));
    temporaryDirectories.push(temporaryRoot);
    await fs.cp(SIMPLE_PROJECT, temporaryRoot, { recursive: true });

    const session = new ProjectScanSession({ rootDir: temporaryRoot });
    const initialResult = await session.scan();
    expect(session.getStats()).toMatchObject({
      entries: initialResult.totalFiles,
      hits: 0,
      misses: initialResult.totalFiles,
    });

    session.resetStats();
    await session.scan();
    expect(session.getStats()).toMatchObject({
      hits: initialResult.totalFiles,
      misses: 0,
    });

    await fs.appendFile(path.join(temporaryRoot, 'src/App.tsx'), '\nexport const changed = true;\n');
    session.resetStats();
    await session.scan();
    expect(session.getStats()).toMatchObject({
      hits: initialResult.totalFiles - 1,
      misses: 1,
    });
  });
});
