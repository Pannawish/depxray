import * as fs from 'node:fs/promises';
import type {
  ExplorerGraphData,
  ExplorerGraphSet,
  RuleValidationResult,
  ScanResult,
} from '@depxray/core';

export function serializeGraphData(data: ExplorerGraphData): string {
  return JSON.stringify(data, null, 2);
}

export function serializeGraphSet(data: ExplorerGraphSet): string {
  return JSON.stringify(data, null, 2);
}

export function printOrphanFiles(orphanFiles: string[]): void {
  if (orphanFiles.length === 0) {
    process.stderr.write('No orphan files found.\n');
    return;
  }
  process.stderr.write(`Orphan files (${orphanFiles.length}):\n`);
  orphanFiles.forEach((file) => process.stderr.write(`  ${file}\n`));
}

export function printUnusedExports(result: ScanResult): void {
  const files = result.graph.nodes
    .filter((node) => (node.unusedExports?.length ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.unusedExports?.length ?? 0) - (a.unusedExports?.length ?? 0) ||
        a.relativePath.localeCompare(b.relativePath),
    );
  if (files.length === 0) {
    process.stderr.write('No unused exports found.\n');
    return;
  }

  const total = files.reduce((count, node) => count + (node.unusedExports?.length ?? 0), 0);
  process.stderr.write(`Unused exports (${total}) across ${files.length} file(s):\n`);
  for (const node of files) {
    process.stderr.write(`  ${node.relativePath}\n`);
    for (const item of node.unusedExports ?? []) {
      process.stderr.write(
        `    - ${item.name} (${item.kind}${item.isTypeOnly ? ' type-only' : ''}) line ${item.line}\n`,
      );
    }
  }
}

export function printUnresolvedImports(items: ScanResult['unresolvedImports']): void {
  if (items.length === 0) {
    process.stderr.write('No unresolved imports found.\n');
    return;
  }
  process.stderr.write(`Unresolved imports (${items.length}):\n`);
  items.forEach((item) => {
    process.stderr.write(`  ${item.file}:${item.line} -> ${item.importSpecifier}\n`);
  });
}

export function printRuleViolations(validation: RuleValidationResult | undefined): void {
  if (!validation || validation.violations.length === 0) {
    process.stderr.write('No architecture rule violations found.\n');
    return;
  }
  process.stderr.write(
    `Architecture rule violations: ${validation.errorCount} error(s), ${validation.warningCount} warning(s)\n`,
  );
  validation.violations.forEach((item) => {
    process.stderr.write(
      `  [${item.severity}] ${item.source} -> ${item.target}: ${item.message}\n`,
    );
  });
}

export async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export async function verifyDirectory(rootDir: string): Promise<void> {
  try {
    const stat = await fs.stat(rootDir);
    if (!stat.isDirectory()) throw new Error();
  } catch {
    throw new Error(`Directory not found: ${rootDir}`);
  }
}
