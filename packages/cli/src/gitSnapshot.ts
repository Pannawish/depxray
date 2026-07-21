import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf-8' }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

export async function withGitSnapshot<T>(
  repositoryRoot: string,
  ref: string,
  callback: (snapshotRoot: string) => Promise<T>,
): Promise<T> {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'depxray-baseline-'));
  const archivePath = path.join(temporaryRoot, 'snapshot.tar');
  const extractedRoot = path.join(temporaryRoot, 'project');

  try {
    await fs.mkdir(extractedRoot);
    const gitRoot = path.resolve((await run('git', [
      '-C', repositoryRoot,
      'rev-parse',
      '--show-toplevel',
    ])).trim());
    const repositorySubdirectory = path.relative(gitRoot, repositoryRoot);
    const archiveArgs = [
      '-C', gitRoot,
      'archive',
      '--format=tar',
      '--output', archivePath,
      ref,
    ];
    if (repositorySubdirectory) {
      archiveArgs.push('--', repositorySubdirectory);
    }
    await run('git', [
      ...archiveArgs,
    ]);
    await run('tar', ['-xf', archivePath, '-C', extractedRoot]);
    const snapshotRoot = repositorySubdirectory
      ? path.join(extractedRoot, repositorySubdirectory)
      : extractedRoot;
    return await callback(snapshotRoot);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}
