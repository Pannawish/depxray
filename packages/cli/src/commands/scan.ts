import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command } from 'commander';
import { WebSocketServer, type WebSocket } from 'ws';
import cliPackageJson from '../../package.json';
import { formatAsDot } from '../formatters/dot.js';
import { formatAsMermaid } from '../formatters/mermaid.js';
import { loadPlugins } from '../plugins.js';
import {
  buildStructureGraph,
  createDependencyGraphPayload,
  createStructureGraphPayload,
  DEFAULT_IGNORE_PATTERNS,
  GRAPH_PAYLOAD_SCHEMA_VERSION,
  loadConfig,
  matchesAnyPattern,
  ProjectScanSession,
  scanFileTree,
  scanProject,
  type DepxrayConfig,
  type DepxrayPlugin,
  type ExplorerGraphData,
  type ExplorerGraphMode,
  type ExplorerGraphSet,
  type FileTreeNode,
  type RuleValidationResult,
  type ScanResult,
  type ScanOptions,
  type StructureGraph,
} from '@depxray/core';

type GraphMode = ExplorerGraphMode;
type ScanOutputFormat = 'json' | 'mermaid' | 'dot' | 'sarif';

interface ScanCommandOptions {
  json?: boolean;
  html?: boolean;
  output?: string;
  ignore?: string[];
  depth?: string;
  port?: string;
  mode?: string;
  format?: string;
  circular?: boolean;
  aliases?: boolean;
  extensions?: string[];
  orphans?: boolean;
  unusedExports?: boolean;
  unresolved?: boolean;
  deps?: boolean;
  validate?: boolean;
  fix?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  ignoreTypeImports?: boolean;
  rules?: DepxrayConfig['rules'];
  prodEntryPoints?: string[];
  devEntryPoints?: string[];
  importConventions?: DepxrayConfig['importConventions'];
  plugins?: DepxrayPlugin[];
  entryPoints?: string[];
  open?: boolean;
  watch?: boolean;
}

type OptionSourceReader = (name: string) => string | undefined;

const EXPORT_SCHEMA_VERSION = GRAPH_PAYLOAD_SCHEMA_VERSION;
const MAX_PORT_SEARCH_ATTEMPTS = 10;
const WATCH_DEBOUNCE_MS = 150;

export interface GraphServerHandle {
  port: number;
  updateData(nextData: { tree: FileTreeNode; graphSet: ExplorerGraphSet }): void;
  close(): Promise<void>;
}

interface LiveGraphSetMessage {
  type: 'graph-set';
  graphSet: ExplorerGraphSet;
}

interface FileWatcher {
  close(): Promise<void>;
  on(eventName: string, listener: (...args: any[]) => void): FileWatcher;
}

function parseDepth(value: string | undefined): number | 'all' {
  if (!value) {
    return 2;
  }

  if (value === 'all') {
    return 'all';
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid depth: ${value}. Use an integer >= 1 or "all".`);
  }

  return parsed;
}

export function parsePort(value: string | undefined): number {
  if (!value) {
    return 5178;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}. Use a number between 1 and 65535.`);
  }

  return parsed;
}

function cliOptionWasProvided(getOptionSource: OptionSourceReader, name: string): boolean {
  return getOptionSource(name) === 'cli';
}

export function mergeScanOptionsWithConfig(
  rawOptions: ScanCommandOptions,
  config: DepxrayConfig,
  getOptionSource: OptionSourceReader = () => undefined,
): ScanCommandOptions {
  return {
    ...rawOptions,
    ignore: cliOptionWasProvided(getOptionSource, 'ignore')
      ? rawOptions.ignore
      : config.ignore ?? rawOptions.ignore,
    mode: cliOptionWasProvided(getOptionSource, 'mode')
      ? rawOptions.mode
      : config.mode ?? rawOptions.mode,
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : config.circular ?? rawOptions.circular,
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : config.aliases ?? rawOptions.aliases,
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : config.extensions ?? rawOptions.extensions,
    entryPoints: cliOptionWasProvided(getOptionSource, 'entryPoints')
      ? rawOptions.entryPoints
      : config.entryPoints ?? rawOptions.entryPoints,
    depth: cliOptionWasProvided(getOptionSource, 'depth')
      ? rawOptions.depth
      : config.depth === undefined
        ? rawOptions.depth
        : String(config.depth),
    port: cliOptionWasProvided(getOptionSource, 'port')
      ? rawOptions.port
      : config.port === undefined
        ? rawOptions.port
        : String(config.port),
    rules: config.rules ?? rawOptions.rules,
    prodEntryPoints: cliOptionWasProvided(getOptionSource, 'prodEntryPoints')
      ? rawOptions.prodEntryPoints
      : config.prodEntryPoints ?? rawOptions.prodEntryPoints,
    devEntryPoints: cliOptionWasProvided(getOptionSource, 'devEntryPoints')
      ? rawOptions.devEntryPoints
      : config.devEntryPoints ?? rawOptions.devEntryPoints,
    ignoreTypeImports: cliOptionWasProvided(getOptionSource, 'ignoreTypeImports')
      ? rawOptions.ignoreTypeImports
      : config.ignoreTypeImports ?? rawOptions.ignoreTypeImports,
    importConventions: config.importConventions ?? rawOptions.importConventions,
    plugins: rawOptions.plugins,
  };
}

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
}

export async function listenOnAvailablePort(
  server: http.Server,
  requestedPort: number,
  host = '127.0.0.1',
  maxAttempts = MAX_PORT_SEARCH_ATTEMPTS,
): Promise<number> {
  const upperBound = Math.min(65535, requestedPort + maxAttempts - 1);

  for (let port = requestedPort; port <= upperBound; port += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });

      return port;
    } catch (error) {
      if (!isAddressInUseError(error) || port === upperBound) {
        if (isAddressInUseError(error)) {
          throw new Error(
            `No available port found between ${requestedPort} and ${upperBound}.`,
          );
        }
        throw error;
      }
    }
  }

  throw new Error(`No available port found between ${requestedPort} and ${upperBound}.`);
}

function parseMode(value: string | undefined): GraphMode {
  if (!value || value === 'structure') {
    return 'structure';
  }

  if (value === 'dependencies') {
    return 'dependencies';
  }

  throw new Error(`Invalid mode: ${value}. Use "structure" or "dependencies".`);
}

function parseOutputFormat(value: string | undefined): ScanOutputFormat {
  if (!value || value === 'json') {
    return 'json';
  }

  if (value === 'mermaid' || value === 'dot' || value === 'sarif') {
    return value;
  }

  throw new Error(`Invalid format: ${value}. Use "json", "mermaid", "dot", or "sarif".`);
}

function getGeneratedBy(): string {
  return `depxray@${cliPackageJson.version}`;
}

function toStructureGraphData(graph: StructureGraph): ExplorerGraphData {
  return createStructureGraphPayload(graph, { generatedBy: getGeneratedBy() });
}

function toDependencyGraphData(result: ScanResult): ExplorerGraphData {
  return createDependencyGraphPayload(result, { generatedBy: getGeneratedBy() });
}

function serializeGraphData(data: ExplorerGraphData): string {
  return JSON.stringify(data, null, 2);
}

function serializeGraphSet(data: ExplorerGraphSet): string {
  return JSON.stringify(data, null, 2);
}

function sarifLocation(file: string, line = 1) {
  return {
    physicalLocation: {
      artifactLocation: { uri: file },
      region: { startLine: Math.max(1, line || 1) },
    },
  };
}

function formatAsSarif(result: ScanResult): string {
  const rules = [
    ['depxray/circular-dependency', 'Circular dependency'],
    ['depxray/orphan-file', 'Orphan file'],
    ['depxray/unused-export', 'Unused export'],
    ['depxray/unresolved-import', 'Unresolved import'],
    ['depxray/architecture-rule', 'Architecture rule violation'],
    ['depxray/dev-dependency-in-prod', 'DevDependency used in production'],
    ['depxray/import-convention', 'Import convention violation'],
  ].map(([id, name]) => ({
    id,
    name,
    shortDescription: { text: name },
  }));

  const results: unknown[] = [];

  for (const chain of result.graph.circularDependencies) {
    results.push({
      ruleId: 'depxray/circular-dependency',
      level: 'error',
      message: { text: chain.description },
      locations: [sarifLocation(chain.chain[0] ?? result.graph.rootDir)],
    });
  }

  for (const orphanFile of result.orphanFiles) {
    results.push({
      ruleId: 'depxray/orphan-file',
      level: 'warning',
      message: { text: `Orphan file: ${orphanFile}` },
      locations: [sarifLocation(orphanFile)],
    });
  }

  for (const node of result.graph.nodes) {
    for (const unusedExport of node.unusedExports ?? []) {
      results.push({
        ruleId: 'depxray/unused-export',
        level: 'warning',
        message: { text: `Unused ${unusedExport.kind} export: ${unusedExport.name}` },
        locations: [sarifLocation(node.relativePath, unusedExport.line)],
      });
    }
  }

  for (const unresolvedImport of result.unresolvedImports) {
    results.push({
      ruleId: 'depxray/unresolved-import',
      level: 'error',
      message: { text: `Unresolved import: ${unresolvedImport.importSpecifier}` },
      locations: [sarifLocation(unresolvedImport.file, unresolvedImport.line)],
    });
  }

  for (const violation of result.ruleValidation?.violations ?? []) {
    results.push({
      ruleId: 'depxray/architecture-rule',
      level: violation.severity === 'error' ? 'error' : 'warning',
      message: { text: violation.message },
      locations: [sarifLocation(violation.source)],
    });
  }

  for (const finding of result.devDepsInProd ?? []) {
    results.push({
      ruleId: 'depxray/dev-dependency-in-prod',
      level: 'error',
      message: { text: `Production path imports devDependency ${finding.module}` },
      locations: [sarifLocation(finding.file, finding.line)],
    });
  }

  for (const violation of result.importConventionViolations ?? []) {
    results.push({
      ruleId: 'depxray/import-convention',
      level: 'warning',
      message: { text: `Expected ${violation.expected} import for ${violation.importSpecifier}; use ${violation.suggestedSpecifier}` },
      locations: [sarifLocation(violation.file, violation.line)],
    });
  }

  return JSON.stringify({
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'depxray',
            informationUri: 'https://github.com/Pannawish/depxray',
            rules,
          },
        },
        results,
      },
    ],
  }, null, 2);
}

function printOrphanFiles(orphanFiles: string[]): void {
  if (orphanFiles.length === 0) {
    process.stderr.write('No orphan files found.\n');
    return;
  }

  process.stderr.write(`Orphan files (${orphanFiles.length}):\n`);
  for (const orphanFile of orphanFiles) {
    process.stderr.write(`  ${orphanFile}\n`);
  }
}

function printUnusedExports(result: ScanResult): void {
  const filesWithUnusedExports = result.graph.nodes
    .filter((node) => (node.unusedExports?.length ?? 0) > 0)
    .sort((a, b) => (
      (b.unusedExports?.length ?? 0) - (a.unusedExports?.length ?? 0)
      || a.relativePath.localeCompare(b.relativePath)
    ));

  if (filesWithUnusedExports.length === 0) {
    process.stderr.write('No unused exports found.\n');
    return;
  }

  const totalUnusedExports = filesWithUnusedExports.reduce(
    (count, node) => count + (node.unusedExports?.length ?? 0),
    0,
  );
  process.stderr.write(
    `Unused exports (${totalUnusedExports}) across ${filesWithUnusedExports.length} file(s):\n`,
  );

  for (const node of filesWithUnusedExports) {
    process.stderr.write(`  ${node.relativePath}\n`);
    for (const unusedExport of node.unusedExports ?? []) {
      const flags = unusedExport.isTypeOnly ? ' type-only' : '';
      process.stderr.write(
        `    - ${unusedExport.name} (${unusedExport.kind}${flags}) line ${unusedExport.line}\n`,
      );
    }
  }
}

function printUnresolvedImports(unresolvedImports: ScanResult['unresolvedImports']): void {
  if (unresolvedImports.length === 0) {
    process.stderr.write('No unresolved imports found.\n');
    return;
  }

  process.stderr.write(`Unresolved imports (${unresolvedImports.length}):\n`);
  for (const unresolvedImport of unresolvedImports) {
    process.stderr.write(
      `  ${unresolvedImport.file}:${unresolvedImport.line} -> ${unresolvedImport.importSpecifier}\n`,
    );
  }
}

interface FixAction {
  kind: 'remove-unused-export' | 'delete-orphan-file' | 'rewrite-import' | 'remove-unused-dependency';
  filePath: string;
  relativePath: string;
  line?: number;
  exportName?: string;
  importSpecifier?: string;
  suggestedSpecifier?: string;
  dependencyName?: string;
}

interface FixSummary {
  planned: FixAction[];
  applied: FixAction[];
  skipped: Array<{ action: FixAction; reason: string }>;
}

function planFixes(result: ScanResult): FixAction[] {
  const actions: FixAction[] = [];

  for (const node of result.graph.nodes) {
    for (const unusedExport of node.unusedExports ?? []) {
      actions.push({
        kind: 'remove-unused-export',
        filePath: node.id,
        relativePath: node.relativePath,
        line: unusedExport.line,
        exportName: unusedExport.name,
      });
    }
  }

  for (const orphanFile of result.orphanFiles) {
    actions.push({
      kind: 'delete-orphan-file',
      filePath: path.join(result.graph.rootDir, orphanFile),
      relativePath: orphanFile,
    });
  }

  for (const violation of result.importConventionViolations ?? []) {
    actions.push({
      kind: 'rewrite-import',
      filePath: path.join(result.graph.rootDir, violation.file),
      relativePath: violation.file,
      line: violation.line,
      importSpecifier: violation.importSpecifier,
      suggestedSpecifier: violation.suggestedSpecifier,
    });
  }

  for (const dependencyName of result.dependencyIssues?.unused ?? []) {
    actions.push({
      kind: 'remove-unused-dependency',
      filePath: path.join(result.graph.rootDir, 'package.json'),
      relativePath: 'package.json',
      dependencyName,
    });
  }

  return actions.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || (a.line ?? 0) - (b.line ?? 0));
}

function printFixPlan(actions: FixAction[], dryRun: boolean): void {
  if (actions.length === 0) {
    process.stderr.write('No autofix actions found.\n');
    return;
  }

  process.stderr.write(`${dryRun ? 'Planned' : 'Autofix'} actions (${actions.length}):\n`);
  for (const action of actions) {
    if (action.kind === 'delete-orphan-file') {
      process.stderr.write(`  delete orphan file: ${action.relativePath}\n`);
    } else if (action.kind === 'remove-unused-dependency') {
      process.stderr.write(`  remove unused dependency: ${action.dependencyName} from ${action.relativePath}\n`);
    } else if (action.kind === 'rewrite-import') {
      process.stderr.write(`  rewrite import: ${action.relativePath}:${action.line} ${action.importSpecifier} -> ${action.suggestedSpecifier}\n`);
    } else {
      process.stderr.write(`  remove unused export: ${action.relativePath}:${action.line} ${action.exportName}\n`);
    }
  }
}

async function confirmFixes(yes: boolean | undefined): Promise<void> {
  if (yes) {
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error('--fix requires --yes in non-interactive terminals.');
  }

  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question('Apply these fixes? Type "yes" to continue: ');
    if (answer.trim().toLowerCase() !== 'yes') {
      throw new Error('Autofix cancelled.');
    }
  } finally {
    readline.close();
  }
}

function canSafelyRemoveExportLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('export ')) {
    return false;
  }

  if (/^export\s+\{/.test(trimmed) && trimmed.includes(',')) {
    return false;
  }

  return true;
}

async function applyFixes(actions: FixAction[]): Promise<FixSummary> {
  const applied: FixAction[] = [];
  const skipped: FixSummary['skipped'] = [];
  const deleteActions = actions.filter((action) => action.kind === 'delete-orphan-file');
  const dependencyActions = actions.filter((action) => action.kind === 'remove-unused-dependency');
  const rewriteActionsByFile = new Map<string, FixAction[]>();
  const exportActionsByFile = new Map<string, FixAction[]>();

  for (const action of actions) {
    if (action.kind !== 'remove-unused-export') {
      if (action.kind === 'rewrite-import') {
        const current = rewriteActionsByFile.get(action.filePath);
        if (current) {
          current.push(action);
        } else {
          rewriteActionsByFile.set(action.filePath, [action]);
        }
      }
      continue;
    }

    const current = exportActionsByFile.get(action.filePath);
    if (current) {
      current.push(action);
    } else {
      exportActionsByFile.set(action.filePath, [action]);
    }
  }

  for (const [filePath, fileActions] of exportActionsByFile) {
    const original = await fs.readFile(filePath, 'utf-8');
    const lines = original.split('\n');
    const removeLines = new Set<number>();

    for (const action of fileActions) {
      const lineIndex = (action.line ?? 0) - 1;
      const line = lines[lineIndex];
      if (line === undefined || !canSafelyRemoveExportLine(line)) {
        skipped.push({ action, reason: 'not a safe single-line export removal' });
        continue;
      }

      removeLines.add(lineIndex);
      applied.push(action);
    }

    if (removeLines.size > 0) {
      const next = lines.filter((_, index) => !removeLines.has(index)).join('\n');
      await fs.writeFile(filePath, next, 'utf-8');
    }
  }

  for (const [filePath, fileActions] of rewriteActionsByFile) {
    let source = await fs.readFile(filePath, 'utf-8');
    for (const action of fileActions) {
      if (!action.importSpecifier || !action.suggestedSpecifier) {
        skipped.push({ action, reason: 'missing import rewrite target' });
        continue;
      }
      const singleQuoted = `'${action.importSpecifier}'`;
      const doubleQuoted = `"${action.importSpecifier}"`;
      if (source.includes(singleQuoted)) {
        source = source.replace(singleQuoted, `'${action.suggestedSpecifier}'`);
        applied.push(action);
      } else if (source.includes(doubleQuoted)) {
        source = source.replace(doubleQuoted, `"${action.suggestedSpecifier}"`);
        applied.push(action);
      } else {
        skipped.push({ action, reason: 'import specifier not found' });
      }
    }
    await fs.writeFile(filePath, source, 'utf-8');
  }

  if (dependencyActions.length > 0) {
    const actionsByPackageJson = new Map<string, FixAction[]>();
    for (const action of dependencyActions) {
      const current = actionsByPackageJson.get(action.filePath);
      if (current) {
        current.push(action);
      } else {
        actionsByPackageJson.set(action.filePath, [action]);
      }
    }

    const dependencySections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const;

    for (const [filePath, fileActions] of actionsByPackageJson) {
      const original = await fs.readFile(filePath, 'utf-8');
      const packageJson = JSON.parse(original) as Record<string, unknown>;
      let changed = false;

      for (const action of fileActions) {
        if (!action.dependencyName) {
          skipped.push({ action, reason: 'missing dependency name' });
          continue;
        }

        let removed = false;
        for (const section of dependencySections) {
          const dependencies = packageJson[section];
          if (
            dependencies &&
            typeof dependencies === 'object' &&
            !Array.isArray(dependencies) &&
            Object.prototype.hasOwnProperty.call(dependencies, action.dependencyName)
          ) {
            delete (dependencies as Record<string, unknown>)[action.dependencyName];
            if (Object.keys(dependencies as Record<string, unknown>).length === 0) {
              delete packageJson[section];
            }
            removed = true;
            changed = true;
          }
        }

        if (removed) {
          applied.push(action);
        } else {
          skipped.push({ action, reason: 'dependency not found in package.json' });
        }
      }

      if (changed) {
        await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
      }
    }
  }

  for (const action of deleteActions) {
    await fs.rm(action.filePath, { force: true });
    applied.push(action);
  }

  return { planned: actions, applied, skipped };
}

function printFixSummary(summary: FixSummary): void {
  process.stderr.write(`Autofix applied ${summary.applied.length}/${summary.planned.length} action(s).\n`);
  if (summary.skipped.length > 0) {
    process.stderr.write(`Skipped ${summary.skipped.length} action(s):\n`);
    for (const item of summary.skipped) {
      process.stderr.write(`  ${item.action.relativePath}: ${item.reason}\n`);
    }
  }
}

function printRuleViolations(validation: RuleValidationResult | undefined): void {
  if (!validation || validation.violations.length === 0) {
    process.stderr.write('No architecture rule violations found.\n');
    return;
  }

  process.stderr.write(
    `Architecture rule violations: ${validation.errorCount} error(s), ${validation.warningCount} warning(s)\n`,
  );
  for (const violation of validation.violations) {
    process.stderr.write(
      `  [${violation.severity}] ${violation.source} -> ${violation.target}: ${violation.message}\n`,
    );
  }
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function verifyDirectory(rootDir: string): Promise<void> {
  try {
    const stat = await fs.stat(rootDir);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${rootDir}`);
    }
  } catch {
    throw new Error(`Directory not found: ${rootDir}`);
  }
}

function getWebUiDistDir(): string {
  const candidateDirs = [
    path.resolve(__dirname, 'web-ui'),
    path.resolve(__dirname, '../../web-ui'),
    path.resolve(__dirname, '../web-ui/dist'),
    path.resolve(__dirname, '../../../web-ui/dist'),
  ];

  for (const candidateDir of candidateDirs) {
    try {
      const stat = statSync(candidateDir);
      if (stat.isDirectory()) {
        return candidateDir;
      }
    } catch {
      continue;
    }
  }

  return candidateDirs[0];
}

async function requireWebUiDist(): Promise<string> {
  const distDir = getWebUiDistDir();
  try {
    const stat = await fs.stat(distDir);
    if (!stat.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(
      `Web UI build not found at ${distDir}. Run "npm run build --workspace @depxray/web-ui" first.`,
    );
  }

  return distDir;
}

function inferContentType(filePath: string): string {
  const extension = path.extname(filePath);
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

function normalizeInitialDepth(depth: number | 'all'): string {
  return depth === 'all' ? 'all' : String(depth);
}

async function createStaticExport(
  outputDir: string,
  graphSet: ExplorerGraphSet,
  initialDepth: number | 'all',
): Promise<string> {
  const webUiDistDir = await requireWebUiDist();
  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDirectory(outputDir);
  await fs.cp(webUiDistDir, outputDir, { recursive: true });

  const graphSetJson = serializeGraphSet(graphSet);
  await fs.writeFile(
    path.join(outputDir, 'graph-data.json'),
    graphSetJson,
    'utf-8',
  );

  const indexPath = path.join(outputDir, 'index.html');
  const originalIndex = await fs.readFile(indexPath, 'utf-8');
  const injectedIndex = originalIndex.replace(
    '</body>',
    `    <script>window.__GRAPH_DATA_SET__ = ${graphSetJson}; window.__DEPXRAY_INITIAL_DEPTH__ = ${JSON.stringify(normalizeInitialDepth(initialDepth))}; window.__DEPXRAY_INITIAL_MODE__ = ${JSON.stringify(graphSet.defaultMode)};</script>\n  </body>`,
  );
  await fs.writeFile(indexPath, injectedIndex, 'utf-8');

  return indexPath;
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function readStaticAsset(
  distDir: string,
  requestPath: string,
): Promise<{ body: Buffer; contentType: string }> {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.resolve(distDir, '.' + normalizedPath);
  const distRoot = path.resolve(distDir);

  if (!filePath.startsWith(distRoot)) {
    throw new Error('Forbidden');
  }

  const body = await fs.readFile(filePath);
  return {
    body,
    contentType: inferContentType(filePath),
  };
}

export async function startGraphServer(
  rootDir: string,
  tree: FileTreeNode,
  graphSet: ExplorerGraphSet,
  requestedPort: number,
  initialDepth: number | 'all',
): Promise<GraphServerHandle> {
  const distDir = await requireWebUiDist();
  let currentTree = tree;
  let currentGraphSet = graphSet;
  let treeJson = JSON.stringify(currentTree, null, 2);
  let graphSetJson = serializeGraphSet(currentGraphSet);
  const initialDepthValue = normalizeInitialDepth(initialDepth);
  const liveServer = new WebSocketServer({ noServer: true });

  function createLiveMessage(): string {
    return JSON.stringify({
      type: 'graph-set',
      graphSet: currentGraphSet,
    } satisfies LiveGraphSetMessage);
  }

  function sendLiveMessage(client: WebSocket): void {
    if (client.readyState === client.OPEN) {
      client.send(createLiveMessage());
    }
  }

  function broadcastLiveUpdate(): void {
    for (const client of liveServer.clients) {
      sendLiveMessage(client);
    }
  }

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    const requestPath = requestUrl.pathname;

    try {
      if (requestPath === '/api/graph-set') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(graphSetJson);
        return;
      }

      if (requestPath === '/api/graph-data') {
        const requestedMode = parseMode(requestUrl.searchParams.get('mode') ?? graphSet.defaultMode);
        const graphData = graphSet.graphs[requestedMode];
        if (!graphData) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`Graph mode not available: ${requestedMode}`);
          return;
        }

        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(serializeGraphData(graphData));
        return;
      }

      if (requestPath === '/api/tree') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(treeJson);
        return;
      }

      if (requestPath === '/api/file') {
        const filePathParam = requestUrl.searchParams.get('path');
        if (!filePathParam) {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Missing path parameter');
          return;
        }

        const resolvedPath = path.resolve(rootDir, filePathParam);
        const relative = path.relative(rootDir, resolvedPath);
        const isSafe = !relative.startsWith('..') && !path.isAbsolute(relative);

        if (!isSafe) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Forbidden');
          return;
        }

        try {
          const content = await fs.readFile(resolvedPath, 'utf-8');
          res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(content);
        } catch (err) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('File not found');
        }
        return;
      }

      if (requestPath === '/' || requestPath === '/index.html') {
        const indexPath = path.join(distDir, 'index.html');
        const originalIndex = await fs.readFile(indexPath, 'utf-8');
        const indexHtml = originalIndex.replace(
          '</body>',
          `    <script>window.__DEPXRAY_INITIAL_DEPTH__ = ${JSON.stringify(initialDepthValue)}; window.__DEPXRAY_INITIAL_MODE__ = ${JSON.stringify(graphSet.defaultMode)};</script>\n  </body>`,
        );
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(indexHtml);
        return;
      }

      const asset = await readStaticAsset(distDir, requestPath);
      res.writeHead(200, { 'content-type': asset.contentType });
      res.end(asset.body);
    } catch (err) {
      const error = err as Error;
      if (error.message === 'Forbidden') {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (requestUrl.pathname !== '/api/live') {
      socket.destroy();
      return;
    }

    liveServer.handleUpgrade(req, socket, head, (client) => {
      liveServer.emit('connection', client, req);
    });
  });

  liveServer.on('connection', (client) => {
    sendLiveMessage(client);
  });

  const port = await listenOnAvailablePort(server, requestedPort);
  const url = `http://127.0.0.1:${port}?depth=${encodeURIComponent(initialDepthValue)}&mode=${encodeURIComponent(graphSet.defaultMode)}`;
  process.stderr.write(`Serving ${rootDir}\n`);
  if (port !== requestedPort) {
    process.stderr.write(
      `Port ${requestedPort} is in use. Using ${port} instead.\n`,
    );
  }
  process.stderr.write(`Opening ${url}\n`);

  return {
    port,
    updateData(nextData) {
      currentTree = nextData.tree;
      currentGraphSet = nextData.graphSet;
      treeJson = JSON.stringify(currentTree, null, 2);
      graphSetJson = serializeGraphSet(currentGraphSet);
      broadcastLiveUpdate();
    },
    async close() {
      for (const client of liveServer.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => liveServer.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function shouldIgnoreWatchPath(rootDir: string, targetPath: string, userIgnorePatterns: string[] = []): boolean {
  const relativePath = path.relative(rootDir, targetPath);
  if (!relativePath) {
    return false;
  }

  const normalizedPath = relativePath.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...userIgnorePatterns];

  return ignorePatterns.some((pattern) => (
    segments.some((segment) => segment === pattern || segment.startsWith(pattern)) ||
    matchesAnyPattern(normalizedPath, [pattern])
  ));
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
    const eventName = latestEventName;
    const filePath = latestFilePath;

    try {
      await rebuild(eventName, filePath);
    } finally {
      rebuilding = false;
      if (pending) {
        pending = false;
        runRebuild().catch(() => undefined);
      }
    }
  }

  return (eventName, filePath) => {
    latestEventName = eventName;
    latestFilePath = filePath;

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      runRebuild().catch(() => undefined);
    }, debounceMs);
  };
}

async function startWatchMode(
  rootDir: string,
  options: ScanCommandOptions,
  serverHandle: GraphServerHandle,
  scanSession: ProjectScanSession,
): Promise<FileWatcher> {
  const { watch: watchFiles } = await import('chokidar');
  const scheduleRebuild = createWatchScheduler(async (eventName, filePath) => {
    const relativePath = path.relative(rootDir, filePath);
    try {
      scanSession.invalidate(filePath);
      const nextData = await buildGraphSet(rootDir, options, scanSession);
      serverHandle.updateData(nextData);
      process.stderr.write(`Updated graph after ${eventName}: ${relativePath}\n`);
    } catch (error) {
      process.stderr.write(`Watch update failed after ${eventName}: ${(error as Error).message}\n`);
    }
  });

  const watcher = watchFiles(rootDir, {
    ignoreInitial: true,
    ignored: (targetPath) => shouldIgnoreWatchPath(rootDir, targetPath, options.ignore),
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 20,
    },
  }) as FileWatcher;

  watcher
    .on('add', (filePath) => scheduleRebuild('add', filePath))
    .on('change', (filePath) => scheduleRebuild('change', filePath))
    .on('unlink', (filePath) => scheduleRebuild('unlink', filePath))
    .on('addDir', (filePath) => scheduleRebuild('addDir', filePath))
    .on('unlinkDir', (filePath) => scheduleRebuild('unlinkDir', filePath))
    .on('error', (error) => {
      process.stderr.write(`Watch error: ${(error as Error).message}\n`);
    });

  process.stderr.write('Watching for file changes...\n');
  return watcher;
}

function createDependencyScanOptions(
  rootDir: string,
  options: ScanCommandOptions,
): ScanOptions {
  return {
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
    entryPointPatterns: options.entryPoints,
    detectUnusedDeps: options.deps,
    rules: options.rules,
    prodEntryPoints: options.prodEntryPoints,
    devEntryPoints: options.devEntryPoints,
    ignoreTypeImports: options.ignoreTypeImports,
    importConventions: options.importConventions,
    plugins: options.plugins,
  };
}

async function buildSelectedGraphData(
  rootDir: string,
  options: ScanCommandOptions,
): Promise<ExplorerGraphData> {
  const mode = parseMode(options.mode);

  if (mode === 'structure') {
    const tree = await scanFileTree(rootDir, {
      ignorePatterns: options.ignore,
    });
    const structureGraph = buildStructureGraph(tree);
    return toStructureGraphData(structureGraph);
  }

  const result = await scanProject(createDependencyScanOptions(rootDir, options));

  return toDependencyGraphData(result);
}

async function buildDependencyScanResult(
  rootDir: string,
  options: ScanCommandOptions,
  scanSession?: ProjectScanSession,
): Promise<ScanResult> {
  if (scanSession) {
    return scanSession.scan();
  }
  return scanProject(createDependencyScanOptions(rootDir, options));
}

async function buildGraphSet(
  rootDir: string,
  options: ScanCommandOptions,
  scanSession?: ProjectScanSession,
): Promise<{ tree: FileTreeNode; graphSet: ExplorerGraphSet }> {
  const tree = await scanFileTree(rootDir, {
    ignorePatterns: options.ignore,
  });
  const structureGraph = buildStructureGraph(tree);
  const dependencyResult = await buildDependencyScanResult(rootDir, options, scanSession);

  const structureData = toStructureGraphData(structureGraph);
  const dependencyData = toDependencyGraphData(dependencyResult);
  const defaultMode = parseMode(options.mode);

  return {
    tree,
    graphSet: {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      generatedBy: getGeneratedBy(),
      projectRoot: rootDir,
      scannedAt: new Date().toISOString(),
      availableModes: ['structure', 'dependencies'],
      defaultMode,
      graphs: {
        structure: structureData,
        dependencies: dependencyData,
      },
    },
  };
}

export function createScanCommand(): Command {
  const cmd = new Command('scan')
    .description('Scan a project and open a structure or dependency graph in a local browser')
    .argument(
      '[dir]',
      'Project directory to scan (default: current directory)',
      '.',
    )
    .option('--json', 'Print the graph JSON to stdout')
    .option('--html', 'Generate a static HTML export in .depxray/')
    .option('-o, --output <file>', 'Write output to a file instead of stdout')
    .option('--mode <mode>', 'Graph mode: structure | dependencies', 'structure')
    .option('--format <format>', 'Output format for --json: json | mermaid | dot | sarif', 'json')
    .option('--ignore <patterns...>', 'Additional directory/file patterns to ignore')
    .option('--no-circular', 'Skip circular dependency detection in dependency mode')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution in dependency mode')
    .option('--orphans', 'Print orphan files to stderr after dependency scanning')
    .option('--unused-exports', 'Print unused exports to stderr after dependency scanning')
    .option('--unresolved', 'Print unresolved imports to stderr after dependency scanning')
    .option('--deps', 'Include unused and unlisted npm dependency analysis in dependency JSON')
    .option('--validate', 'Validate dependency edges against architecture rules from depxray config')
    .option('--fix', 'Apply safe autofixes for unused exports, orphan files, import conventions, and --deps findings')
    .option('--dry-run', 'Show autofix actions without modifying files')
    .option('--yes', 'Apply autofixes without prompting for confirmation')
    .option('--ignore-type-imports', 'Ignore type-only imports for devDependency production checks')
    .option('--prod-entry-points <patterns...>', 'Production entry point patterns for devDependency checks')
    .option('--dev-entry-points <patterns...>', 'Development-only entry point patterns for devDependency checks')
    .option(
      '--entry-points <patterns...>',
      'Entry point glob patterns to exclude from orphan detection',
    )
    .option(
      '--extensions <exts...>',
      'File extensions to scan in dependency mode (default: .js .jsx .ts .tsx)',
    )
    .option('--depth <depth>', 'Initial visible depth: integer >= 1 or all', '2')
    .option('--port <port>', 'Port for the local browser server', '5178')
    .option('--watch', 'Watch for file changes and update the browser UI live')
    .option('--no-open', 'Do not open the browser automatically')
    .action(async (dir: string, rawOptions: ScanCommandOptions) => {
      try {
        const rootDir = path.resolve(dir);
        const config = await loadConfig(rootDir);
        const options = mergeScanOptionsWithConfig(
          rawOptions,
          config,
          (name) => cmd.getOptionValueSource(name),
        );
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const initialDepth = parseDepth(options.depth);
        const port = parsePort(options.port);
        const outputFormat = parseOutputFormat(options.format);

        if (options.json && options.html) {
          throw new Error('Choose only one output mode: --json or --html.');
        }

        if (options.output && !options.json) {
          throw new Error('--output is only supported together with --json.');
        }

        if (options.watch && (options.json || options.html)) {
          throw new Error('--watch is only supported with the local browser UI.');
        }

        if (options.dryRun && !options.fix) {
          throw new Error('--dry-run is only supported together with --fix.');
        }

        if (options.deps && options.json && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--deps is only supported with --mode dependencies when using --json.');
        }

        if (options.validate && (!options.rules || options.rules.length === 0)) {
          throw new Error('--validate requires rules in depxray config.');
        }

        if (options.validate && options.json && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--validate is only supported with --mode dependencies when using --json.');
        }

        if (options.unusedExports && options.json && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--unused-exports is only supported with --mode dependencies when using --json.');
        }

        if (options.unresolved && options.json && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--unresolved is only supported with --mode dependencies when using --json.');
        }

        if (outputFormat !== 'json' && !options.json) {
          throw new Error('--format is only supported together with --json.');
        }

        if (outputFormat !== 'json' && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--format mermaid|dot|sarif is only supported with --mode dependencies.');
        }

        await verifyDirectory(rootDir);
        process.stderr.write(`Scanning ${rootDir}...\n`);

        if (options.fix) {
          const result = await buildDependencyScanResult(rootDir, options);
          const actions = planFixes(result);
          printFixPlan(actions, Boolean(options.dryRun));
          if (!options.dryRun && actions.length > 0) {
            await confirmFixes(options.yes);
            const summary = await applyFixes(actions);
            printFixSummary(summary);
          }
          return;
        }

        if (options.json) {
          let output: string;
          let validation: RuleValidationResult | undefined;
          if (outputFormat === 'json') {
            const mode = parseMode(options.mode);
            if (mode === 'dependencies') {
              const result = await buildDependencyScanResult(rootDir, options);
              if (options.orphans) {
                printOrphanFiles(result.orphanFiles);
              }
              if (options.unusedExports) {
                printUnusedExports(result);
              }
              if (options.unresolved) {
                printUnresolvedImports(result.unresolvedImports);
              }
              validation = result.ruleValidation;
              if (options.validate) {
                printRuleViolations(validation);
              }
              output = serializeGraphData(toDependencyGraphData(result));
            } else {
              const graphData = await buildSelectedGraphData(rootDir, options);
              validation = graphData.ruleValidation;
              if (options.validate) {
                printRuleViolations(validation);
              }
              output = serializeGraphData(graphData);
            }
          } else {
            const result = await buildDependencyScanResult(rootDir, options);
            if (options.orphans) {
              printOrphanFiles(result.orphanFiles);
            }
            if (options.unusedExports) {
              printUnusedExports(result);
            }
            if (options.unresolved) {
              printUnresolvedImports(result.unresolvedImports);
            }
            validation = result.ruleValidation;
            if (options.validate) {
              printRuleViolations(validation);
            }
            output = outputFormat === 'mermaid'
              ? formatAsMermaid(result)
              : outputFormat === 'dot'
                ? formatAsDot(result)
                : formatAsSarif(result);
          }
          if (options.output) {
            const outputPath = path.resolve(options.output);
            await ensureDirectory(path.dirname(outputPath));
            await fs.writeFile(outputPath, output, 'utf-8');
            process.stderr.write(`Output written to ${outputPath}\n`);
          } else {
            process.stdout.write(output + '\n');
          }
          if (options.validate && validation?.errorCount) {
            process.exit(1);
          }
          return;
        }

        if (options.html) {
          const { graphSet } = await buildGraphSet(rootDir, options);
          if (options.validate) {
            const validation = graphSet.graphs.dependencies?.ruleValidation;
            printRuleViolations(validation);
            if (validation?.errorCount) {
              process.exit(1);
            }
          }
          const outputDir = path.join(rootDir, '.depxray');
          const indexPath = await createStaticExport(outputDir, graphSet, initialDepth);
          process.stderr.write(`Static export written to ${indexPath}\n`);
          return;
        }

        const scanSession = options.watch
          ? new ProjectScanSession(createDependencyScanOptions(rootDir, options))
          : undefined;
        const { tree, graphSet } = await buildGraphSet(rootDir, options, scanSession);
        if (options.orphans) {
          printOrphanFiles(graphSet.graphs.dependencies?.orphanFiles ?? []);
        }
        if (options.unusedExports || options.unresolved) {
          const dependencyResult = await buildDependencyScanResult(rootDir, options);
          if (options.unusedExports) {
            printUnusedExports(dependencyResult);
          }
          if (options.unresolved) {
            printUnresolvedImports(dependencyResult.unresolvedImports);
          }
        }
        if (options.validate) {
          const validation = graphSet.graphs.dependencies?.ruleValidation;
          printRuleViolations(validation);
          if (validation?.errorCount) {
            process.exit(1);
          }
        }
        const serverHandle = await startGraphServer(rootDir, tree, graphSet, port, initialDepth);
        const watcher = options.watch
          ? await startWatchMode(rootDir, options, serverHandle, scanSession!)
          : null;
        const resolvedPort = serverHandle.port;
        if (options.open !== false) {
          const url = `http://127.0.0.1:${resolvedPort}?depth=${encodeURIComponent(normalizeInitialDepth(initialDepth))}&mode=${encodeURIComponent(graphSet.defaultMode)}`;
          await openBrowser(url);
        }

        const shutdown = () => {
          void Promise.resolve()
            .then(() => watcher?.close())
            .then(() => serverHandle.close())
            .finally(() => {
              process.exit(0);
            });
        };

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
        await new Promise<void>(() => undefined);
      } catch (err) {
        console.error(`Scan failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
