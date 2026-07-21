import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { Command } from 'commander';
import {
  diffGraphs,
  exportGraphJSON,
  scanProject,
  type GraphDiffEdge,
  type GraphDiffResult,
} from '@depxray/core';

const execFileAsync = promisify(execFile);

interface DiffCommandOptions {
  json?: boolean;
  base?: string;
  dir?: string;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.resolve(filePath), 'utf-8')) as unknown;
}

function formatEdge(edge: GraphDiffEdge): string {
  return `${edge.source} -> ${edge.target}${edge.importSpecifier ? ` (${edge.importSpecifier})` : ''}`;
}

function addList(lines: string[], title: string, items: string[], empty = 'None'): void {
  lines.push(`${title}: ${items.length}`);
  if (items.length === 0) {
    lines.push(`  ${empty}`);
    return;
  }

  for (const item of items) {
    lines.push(`  ${item}`);
  }
}

function formatDiffText(diff: GraphDiffResult): string {
  const lines: string[] = ['depxray graph diff', ''];
  addList(lines, 'Added files', diff.addedFiles);
  lines.push('');
  addList(lines, 'Removed files', diff.removedFiles);
  lines.push('');
  addList(lines, 'Added edges', diff.addedEdges.map(formatEdge));
  lines.push('');
  addList(lines, 'Removed edges', diff.removedEdges.map(formatEdge));
  lines.push('');
  addList(lines, 'New circular dependencies', diff.addedCircularDependencies);
  lines.push('');
  addList(lines, 'Removed circular dependencies', diff.removedCircularDependencies);
  return `${lines.join('\n')}\n`;
}

async function gitOutput(args: string[], cwd: string): Promise<Buffer> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout as Buffer;
}

async function createSnapshotFromGitRef(rootDir: string, ref: string): Promise<string> {
  const gitRoot = (await gitOutput(['rev-parse', '--show-toplevel'], rootDir))
    .toString('utf-8')
    .trim();
  const relativeRoot = path.relative(gitRoot, rootDir).replaceAll('\\', '/');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'depxray-diff-'));
  const treeArgs = ['ls-tree', '-r', '--name-only', ref];
  if (relativeRoot) {
    treeArgs.push('--', relativeRoot);
  }

  const files = (await gitOutput(treeArgs, gitRoot)).toString('utf-8').split('\n').filter(Boolean);

  for (const file of files) {
    const content = await gitOutput(['show', `${ref}:${file}`], gitRoot);
    const outputRelativePath = relativeRoot ? path.relative(relativeRoot, file) : file;
    const outputPath = path.join(tempDir, outputRelativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content);
  }

  return tempDir;
}

async function scanSnapshot(rootDir: string): Promise<unknown> {
  const result = await scanProject({ rootDir, detectCircular: true });
  return JSON.parse(exportGraphJSON(result.graph)) as unknown;
}

export function createDiffCommand(): Command {
  const cmd = new Command('diff')
    .description('Compare two depxray graph JSON snapshots')
    .argument('[before]', 'Before graph JSON snapshot')
    .argument('[after]', 'After graph JSON snapshot')
    .option('--json', 'Print machine-readable diff JSON')
    .option('--base <ref>', 'Compare the current working tree against a git ref')
    .option('-d, --dir <dir>', 'Project directory for --base comparison', '.')
    .action(
      async (
        before: string | undefined,
        after: string | undefined,
        options: DiffCommandOptions,
      ) => {
        let tempDir: string | null = null;

        try {
          let beforeSnapshot: unknown;
          let afterSnapshot: unknown;

          if (options.base) {
            const rootDir = path.resolve(options.dir ?? '.');
            tempDir = await createSnapshotFromGitRef(rootDir, options.base);
            beforeSnapshot = await scanSnapshot(tempDir);
            afterSnapshot = await scanSnapshot(rootDir);
          } else {
            if (!before || !after) {
              throw new Error('Provide two graph JSON files, or use --base <ref>.');
            }

            beforeSnapshot = await readJsonFile(before);
            afterSnapshot = await readJsonFile(after);
          }

          const diff = diffGraphs(beforeSnapshot as any, afterSnapshot as any);
          process.stdout.write(
            options.json ? `${JSON.stringify(diff, null, 2)}\n` : formatDiffText(diff),
          );
        } catch (err) {
          console.error(`Diff failed: ${(err as Error).message}`);
          process.exit(1);
        } finally {
          if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
          }
        }
      },
    );

  return cmd;
}
