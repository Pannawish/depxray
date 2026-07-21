import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { ScanResult } from '@depxray/core';

export interface FixAction {
  kind:
    | 'remove-unused-export'
    | 'delete-orphan-file'
    | 'rewrite-import'
    | 'remove-unused-dependency';
  filePath: string;
  relativePath: string;
  line?: number;
  exportName?: string;
  importSpecifier?: string;
  suggestedSpecifier?: string;
  dependencyName?: string;
}

export interface FixSummary {
  planned: FixAction[];
  applied: FixAction[];
  skipped: Array<{ action: FixAction; reason: string }>;
}

export function planFixes(result: ScanResult): FixAction[] {
  const actions: FixAction[] = [];
  for (const node of result.graph.nodes) {
    for (const item of node.unusedExports ?? []) {
      actions.push({
        kind: 'remove-unused-export',
        filePath: node.id,
        relativePath: node.relativePath,
        line: item.line,
        exportName: item.name,
      });
    }
  }
  for (const file of result.orphanFiles) {
    actions.push({
      kind: 'delete-orphan-file',
      filePath: path.join(result.graph.rootDir, file),
      relativePath: file,
    });
  }
  for (const item of result.importConventionViolations ?? []) {
    actions.push({
      kind: 'rewrite-import',
      filePath: path.join(result.graph.rootDir, item.file),
      relativePath: item.file,
      line: item.line,
      importSpecifier: item.importSpecifier,
      suggestedSpecifier: item.suggestedSpecifier,
    });
  }
  for (const name of result.dependencyIssues?.unused ?? []) {
    actions.push({
      kind: 'remove-unused-dependency',
      filePath: path.join(result.graph.rootDir, 'package.json'),
      relativePath: 'package.json',
      dependencyName: name,
    });
  }
  return actions.sort(
    (a, b) => a.relativePath.localeCompare(b.relativePath) || (a.line ?? 0) - (b.line ?? 0),
  );
}

export function printFixPlan(actions: FixAction[], dryRun: boolean): void {
  if (actions.length === 0) {
    process.stderr.write('No autofix actions found.\n');
    return;
  }
  process.stderr.write(`${dryRun ? 'Planned' : 'Autofix'} actions (${actions.length}):\n`);
  for (const action of actions) {
    switch (action.kind) {
      case 'delete-orphan-file':
        process.stderr.write(`  delete orphan file: ${action.relativePath}\n`);
        break;
      case 'remove-unused-dependency':
        process.stderr.write(
          `  remove unused dependency: ${action.dependencyName} from ${action.relativePath}\n`,
        );
        break;
      case 'rewrite-import':
        process.stderr.write(
          `  rewrite import: ${action.relativePath}:${action.line} ${action.importSpecifier} -> ${action.suggestedSpecifier}\n`,
        );
        break;
      default:
        process.stderr.write(
          `  remove unused export: ${action.relativePath}:${action.line} ${action.exportName}\n`,
        );
    }
  }
}

export async function confirmFixes(yes: boolean | undefined): Promise<void> {
  if (yes) return;
  if (!process.stdin.isTTY) {
    throw new Error('--fix requires --yes in non-interactive terminals.');
  }
  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question('Apply these fixes? Type "yes" to continue: ');
    if (answer.trim().toLowerCase() !== 'yes') throw new Error('Autofix cancelled.');
  } finally {
    readline.close();
  }
}

function canSafelyRemoveExportLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('export ') && !(/^export\s+\{/.test(trimmed) && trimmed.includes(','));
}

function groupActions(actions: FixAction[], kind: FixAction['kind']): Map<string, FixAction[]> {
  const grouped = new Map<string, FixAction[]>();
  for (const action of actions.filter((item) => item.kind === kind)) {
    const current = grouped.get(action.filePath) ?? [];
    current.push(action);
    grouped.set(action.filePath, current);
  }
  return grouped;
}

async function applyExportRemovals(
  actions: FixAction[],
  applied: FixAction[],
  skipped: FixSummary['skipped'],
): Promise<void> {
  for (const [filePath, fileActions] of groupActions(actions, 'remove-unused-export')) {
    const lines = (await fs.readFile(filePath, 'utf-8')).split('\n');
    const removeLines = new Set<number>();
    for (const action of fileActions) {
      const lineIndex = (action.line ?? 0) - 1;
      const line = lines[lineIndex];
      if (line === undefined || !canSafelyRemoveExportLine(line)) {
        skipped.push({ action, reason: 'not a safe single-line export removal' });
      } else {
        removeLines.add(lineIndex);
        applied.push(action);
      }
    }
    if (removeLines.size > 0) {
      await fs.writeFile(
        filePath,
        lines.filter((_, index) => !removeLines.has(index)).join('\n'),
        'utf-8',
      );
    }
  }
}

async function applyImportRewrites(
  actions: FixAction[],
  applied: FixAction[],
  skipped: FixSummary['skipped'],
): Promise<void> {
  for (const [filePath, fileActions] of groupActions(actions, 'rewrite-import')) {
    let source = await fs.readFile(filePath, 'utf-8');
    for (const action of fileActions) {
      if (!action.importSpecifier || !action.suggestedSpecifier) {
        skipped.push({ action, reason: 'missing import rewrite target' });
        continue;
      }
      const single = `'${action.importSpecifier}'`;
      const double = `"${action.importSpecifier}"`;
      if (source.includes(single)) {
        source = source.replace(single, `'${action.suggestedSpecifier}'`);
        applied.push(action);
      } else if (source.includes(double)) {
        source = source.replace(double, `"${action.suggestedSpecifier}"`);
        applied.push(action);
      } else {
        skipped.push({ action, reason: 'import specifier not found' });
      }
    }
    await fs.writeFile(filePath, source, 'utf-8');
  }
}

async function applyDependencyRemovals(
  actions: FixAction[],
  applied: FixAction[],
  skipped: FixSummary['skipped'],
): Promise<void> {
  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const;
  for (const [filePath, fileActions] of groupActions(actions, 'remove-unused-dependency')) {
    const packageJson = JSON.parse(await fs.readFile(filePath, 'utf-8')) as Record<string, unknown>;
    let changed = false;
    for (const action of fileActions) {
      let removed = false;
      if (action.dependencyName) {
        for (const section of sections) {
          const dependencies = packageJson[section];
          if (
            dependencies &&
            typeof dependencies === 'object' &&
            !Array.isArray(dependencies) &&
            Object.prototype.hasOwnProperty.call(dependencies, action.dependencyName)
          ) {
            delete (dependencies as Record<string, unknown>)[action.dependencyName];
            if (Object.keys(dependencies as Record<string, unknown>).length === 0)
              delete packageJson[section];
            removed = true;
            changed = true;
          }
        }
      }
      if (removed) applied.push(action);
      else skipped.push({ action, reason: 'dependency not found in package.json' });
    }
    if (changed) {
      await fs.writeFile(filePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8');
    }
  }
}

export async function applyFixes(actions: FixAction[]): Promise<FixSummary> {
  const applied: FixAction[] = [];
  const skipped: FixSummary['skipped'] = [];
  await applyExportRemovals(actions, applied, skipped);
  await applyImportRewrites(actions, applied, skipped);
  await applyDependencyRemovals(actions, applied, skipped);
  for (const action of actions.filter((item) => item.kind === 'delete-orphan-file')) {
    await fs.rm(action.filePath, { force: true });
    applied.push(action);
  }
  return { planned: actions, applied, skipped };
}

export function printFixSummary(summary: FixSummary): void {
  process.stderr.write(
    `Autofix applied ${summary.applied.length}/${summary.planned.length} action(s).\n`,
  );
  if (summary.skipped.length > 0) {
    process.stderr.write(`Skipped ${summary.skipped.length} action(s):\n`);
    summary.skipped.forEach((item) => {
      process.stderr.write(`  ${item.action.relativePath}: ${item.reason}\n`);
    });
  }
}
