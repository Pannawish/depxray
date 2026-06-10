import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { Command } from 'commander';
import { WebSocketServer, type WebSocket } from 'ws';
import cliPackageJson from '../../package.json';
import { formatAsDot } from '../formatters/dot.js';
import { formatAsMermaid } from '../formatters/mermaid.js';
import {
  buildStructureGraph,
  DEFAULT_IGNORE_PATTERNS,
  loadConfig,
  matchesAnyPattern,
  scanFileTree,
  scanProject,
  type DepxrayConfig,
  type FileTreeNode,
  type ScanError,
  type ScanResult,
  type StructureGraph,
  type StructureGraphEdge,
  type StructureGraphNode,
} from '@depxray/core';

type GraphMode = 'structure' | 'dependencies';
type ScanOutputFormat = 'json' | 'mermaid' | 'dot';

interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  isOrphan?: boolean;
  componentName?: string;
  workspace?: string;
  metrics?: ScanResult['graph']['nodes'][number]['metrics'];
}

interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: GraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
  isCrossPackage?: boolean;
}

interface ExplorerGraphData {
  schemaVersion: string;
  mode: GraphMode;
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  totalImports: number;
  circularCount: number;
  orphanFiles: string[];
  dependencyIssues?: ScanResult['dependencyIssues'];
  generatedBy: string;
  errors: ScanError[];
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

interface ExplorerGraphSet {
  schemaVersion: string;
  generatedBy: string;
  projectRoot: string;
  scannedAt: string;
  availableModes: GraphMode[];
  defaultMode: GraphMode;
  graphs: Partial<Record<GraphMode, ExplorerGraphData>>;
}

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
  deps?: boolean;
  entryPoints?: string[];
  open?: boolean;
  watch?: boolean;
}

type OptionSourceReader = (name: string) => string | undefined;

const EXPORT_SCHEMA_VERSION = '1.0.0';
const MAX_PORT_SEARCH_ATTEMPTS = 10;
const WATCH_DEBOUNCE_MS = 150;

interface GraphServerHandle {
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

  if (value === 'mermaid' || value === 'dot') {
    return value;
  }

  throw new Error(`Invalid format: ${value}. Use "json", "mermaid", or "dot".`);
}

function getGeneratedBy(): string {
  return `depxray@${cliPackageJson.version}`;
}

function toStructureGraphData(graph: StructureGraph): ExplorerGraphData {
  const scannedAt = new Date().toISOString();
  const totalFiles = graph.nodes.filter((node) => node.kind === 'file').length;
  const totalDirs = graph.nodes.filter((node) => node.kind === 'directory').length;

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    mode: 'structure',
    projectRoot: graph.rootDir,
    scannedAt,
    totalFiles,
    totalDirs,
    totalImports: 0,
    circularCount: 0,
    orphanFiles: [],
    dependencyIssues: undefined,
    generatedBy: getGeneratedBy(),
    errors: [],
    nodes: graph.nodes,
    edges: graph.edges.map((edge) => ({
      ...edge,
      kind: 'structure',
    })),
  };
}

function toDependencyGraphData(result: ScanResult): ExplorerGraphData {
  const orphanFileSet = new Set(result.orphanFiles);
  const nodes: ExplorerGraphNode[] = result.graph.nodes.map((node) => ({
    id: node.id,
    label: path.basename(node.relativePath),
    relativePath: node.relativePath,
    absolutePath: node.id,
    kind: 'file',
    extension: node.extension,
    depth: Math.max(1, node.relativePath.split('/').filter(Boolean).length),
    collapsed: false,
    hidden: false,
    childCount: node.outDegree,
    descendantCount: Math.max(node.inDegree, node.outDegree),
    inDegree: node.inDegree,
    outDegree: node.outDegree,
    isCircular: node.isCircular,
    isOrphan: orphanFileSet.has(node.relativePath),
    ...(node.workspace ? { workspace: node.workspace } : {}),
    ...(node.metrics ? { metrics: node.metrics } : {}),
    ...(node.componentName ? { componentName: node.componentName } : {}),
  }));

  const edges: ExplorerGraphEdge[] = result.graph.edges.map((edge, index) => ({
    id: `${edge.source}->${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    kind: 'dependencies',
    importSpecifier: edge.importSpecifier,
    importedNames: edge.importedNames,
    isTypeOnly: edge.isTypeOnly,
    isDynamic: edge.isDynamic,
    ...(edge.isCrossPackage ? { isCrossPackage: edge.isCrossPackage } : {}),
  }));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    mode: 'dependencies',
    projectRoot: result.graph.rootDir,
    scannedAt: result.graph.metadata.scannedAt,
    totalFiles: result.totalFiles,
    totalDirs: 0,
    totalImports: result.totalImports,
    circularCount: result.circularCount,
    orphanFiles: result.orphanFiles,
    ...(result.dependencyIssues ? { dependencyIssues: result.dependencyIssues } : {}),
    generatedBy: getGeneratedBy(),
    errors: result.errors,
    nodes,
    edges,
  };
}

function serializeGraphData(data: ExplorerGraphData): string {
  return JSON.stringify(data, null, 2);
}

function serializeGraphSet(data: ExplorerGraphSet): string {
  return JSON.stringify(data, null, 2);
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

async function startGraphServer(
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
): Promise<FileWatcher> {
  const { watch: watchFiles } = await import('chokidar');
  const scheduleRebuild = createWatchScheduler(async (eventName, filePath) => {
    const relativePath = path.relative(rootDir, filePath);
    try {
      const nextData = await buildGraphSet(rootDir, options);
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

  const result = await scanProject({
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
    entryPointPatterns: options.entryPoints,
    detectUnusedDeps: options.deps,
  });

  return toDependencyGraphData(result);
}

async function buildDependencyScanResult(
  rootDir: string,
  options: ScanCommandOptions,
): Promise<ScanResult> {
  return scanProject({
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
    entryPointPatterns: options.entryPoints,
    detectUnusedDeps: options.deps,
  });
}

async function buildGraphSet(
  rootDir: string,
  options: ScanCommandOptions,
): Promise<{ tree: FileTreeNode; graphSet: ExplorerGraphSet }> {
  const tree = await scanFileTree(rootDir, {
    ignorePatterns: options.ignore,
  });
  const structureGraph = buildStructureGraph(tree);
  const dependencyResult = await scanProject({
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
    entryPointPatterns: options.entryPoints,
    detectUnusedDeps: options.deps,
  });

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
    .option('--format <format>', 'Output format for --json: json | mermaid | dot', 'json')
    .option('--ignore <patterns...>', 'Additional directory/file patterns to ignore')
    .option('--no-circular', 'Skip circular dependency detection in dependency mode')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution in dependency mode')
    .option('--orphans', 'Print orphan files to stderr after dependency scanning')
    .option('--deps', 'Include unused and unlisted npm dependency analysis in dependency JSON')
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

        if (options.deps && options.json && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--deps is only supported with --mode dependencies when using --json.');
        }

        if (outputFormat !== 'json' && !options.json) {
          throw new Error('--format is only supported together with --json.');
        }

        if (outputFormat !== 'json' && parseMode(options.mode) !== 'dependencies') {
          throw new Error('--format mermaid|dot is only supported with --mode dependencies.');
        }

        await verifyDirectory(rootDir);
        process.stderr.write(`Scanning ${rootDir}...\n`);

        if (options.json) {
          let output: string;
          if (outputFormat === 'json') {
            const graphData = await buildSelectedGraphData(rootDir, options);
            if (options.orphans && graphData.mode === 'dependencies') {
              printOrphanFiles(graphData.orphanFiles);
            }
            output = serializeGraphData(graphData);
          } else {
            const result = await buildDependencyScanResult(rootDir, options);
            if (options.orphans) {
              printOrphanFiles(result.orphanFiles);
            }
            output = outputFormat === 'mermaid'
              ? formatAsMermaid(result)
              : formatAsDot(result);
          }
          if (options.output) {
            const outputPath = path.resolve(options.output);
            await ensureDirectory(path.dirname(outputPath));
            await fs.writeFile(outputPath, output, 'utf-8');
            process.stderr.write(`Output written to ${outputPath}\n`);
          } else {
            process.stdout.write(output + '\n');
          }
          return;
        }

        if (options.html) {
          const { graphSet } = await buildGraphSet(rootDir, options);
          const outputDir = path.join(rootDir, '.depxray');
          const indexPath = await createStaticExport(outputDir, graphSet, initialDepth);
          process.stderr.write(`Static export written to ${indexPath}\n`);
          return;
        }

        const { tree, graphSet } = await buildGraphSet(rootDir, options);
        if (options.orphans) {
          printOrphanFiles(graphSet.graphs.dependencies?.orphanFiles ?? []);
        }
        const serverHandle = await startGraphServer(rootDir, tree, graphSet, port, initialDepth);
        const watcher = options.watch
          ? await startWatchMode(rootDir, options, serverHandle)
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
