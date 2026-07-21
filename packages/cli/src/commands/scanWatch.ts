import * as path from 'node:path';
import { DEFAULT_IGNORE_PATTERNS, matchesAnyPattern, ProjectScanSession } from '@depxray/core';
import type { GraphServerHandle } from './scanBrowser.js';
import { buildGraphSet } from './scanGraph.js';
import type { ScanCommandOptions } from './scanOptions.js';

const WATCH_DEBOUNCE_MS = 150;

interface FileWatcher {
  close(): Promise<void>;
  on(eventName: string, listener: (...args: unknown[]) => void): FileWatcher;
}

function shouldIgnoreWatchPath(
  rootDir: string,
  targetPath: string,
  userIgnorePatterns: string[] = [],
): boolean {
  const relativePath = path.relative(rootDir, targetPath);
  if (!relativePath) return false;

  const normalizedPath = relativePath.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  return [...DEFAULT_IGNORE_PATTERNS, ...userIgnorePatterns].some(
    (pattern) =>
      segments.some((segment) => segment === pattern || segment.startsWith(pattern)) ||
      matchesAnyPattern(normalizedPath, [pattern]),
  );
}

export function createWatchScheduler(
  rebuild: (eventName: string, filePath: string) => Promise<void>,
  debounceMs = WATCH_DEBOUNCE_MS,
): (eventName: string, filePath: string) => void {
  let timer: NodeJS.Timeout | null = null;
  let latestEventName = '';
  let latestFilePath = '';
  let rebuilding = false;
  let pending = false;

  async function runRebuild(): Promise<void> {
    if (rebuilding) {
      pending = true;
      return;
    }
    rebuilding = true;
    try {
      await rebuild(latestEventName, latestFilePath);
    } finally {
      rebuilding = false;
      if (pending) {
        pending = false;
        void runRebuild();
      }
    }
  }

  return (eventName, filePath) => {
    latestEventName = eventName;
    latestFilePath = filePath;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runRebuild();
    }, debounceMs);
  };
}

export async function startWatchMode(
  rootDir: string,
  options: ScanCommandOptions,
  serverHandle: GraphServerHandle,
  scanSession: ProjectScanSession,
): Promise<FileWatcher> {
  const { watch } = await import('chokidar');
  const schedule = createWatchScheduler(async (eventName, filePath) => {
    const relativePath = path.relative(rootDir, filePath);
    try {
      scanSession.invalidate(filePath);
      serverHandle.updateData(await buildGraphSet(rootDir, options, scanSession));
      process.stderr.write(`Updated graph after ${eventName}: ${relativePath}\n`);
    } catch (error) {
      process.stderr.write(`Watch update failed after ${eventName}: ${(error as Error).message}\n`);
    }
  });

  const watcher = watch(rootDir, {
    ignoreInitial: true,
    ignored: (targetPath) => shouldIgnoreWatchPath(rootDir, targetPath, options.ignore),
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
  }) as unknown as FileWatcher;
  watcher
    .on('add', (filePath) => schedule('add', String(filePath)))
    .on('change', (filePath) => schedule('change', String(filePath)))
    .on('unlink', (filePath) => schedule('unlink', String(filePath)))
    .on('addDir', (filePath) => schedule('addDir', String(filePath)))
    .on('unlinkDir', (filePath) => schedule('unlinkDir', String(filePath)))
    .on('error', (error) => process.stderr.write(`Watch error: ${String(error)}\n`));
  process.stderr.write('Watching for file changes...\n');
  return watcher;
}
