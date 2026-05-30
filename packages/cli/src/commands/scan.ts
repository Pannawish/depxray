import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { Command } from 'commander';
import {
  buildStructureGraph,
  scanFileTree,
  scanProject,
  type FileTreeNode,
  type GraphEdge as DependencyGraphEdge,
  type GraphNode as DependencyGraphNode,
  type ScanError,
  type ScanResult,
  type StructureGraph,
  type StructureGraphEdge,
  type StructureGraphNode,
} from '@rdg/core';

type GraphMode = 'structure' | 'dependencies';

interface ExplorerGraphNode extends StructureGraphNode {
  inDegree?: number;
  outDegree?: number;
  isCircular?: boolean;
  componentName?: string;
}

interface ExplorerGraphEdge extends StructureGraphEdge {
  kind: GraphMode;
  importSpecifier?: string;
  importedNames?: string[];
  isTypeOnly?: boolean;
  isDynamic?: boolean;
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
  generatedBy: string;
  errors: ScanError[];
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
}

interface ScanCommandOptions {
  json?: boolean;
  html?: boolean;
  output?: string;
  ignore?: string[];
  depth?: string;
  port?: string;
  mode?: string;
  circular?: boolean;
  aliases?: boolean;
  extensions?: string[];
  open?: boolean;
}

const EXPORT_SCHEMA_VERSION = '1.0.0';
const RDG_CLI_VERSION = '0.3.0';

function parseDepth(value: string | undefined): number | 'all' {
  if (!value) {
    return 2;
  }

  if (value === 'all') {
    return 'all';
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid depth: ${value}. Use 1, 2, 3, 4, or "all".`);
  }

  return parsed;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 5178;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}. Use a number between 1 and 65535.`);
  }

  return parsed;
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

function getGeneratedBy(): string {
  return `react-dependency-graph@${RDG_CLI_VERSION}`;
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
    totalImports: graph.edges.length,
    circularCount: 0,
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
    generatedBy: getGeneratedBy(),
    errors: result.errors,
    nodes,
    edges,
  };
}

function serializeGraphData(data: ExplorerGraphData): string {
  return JSON.stringify(data, null, 2);
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
  return path.resolve(__dirname, '../../../web-ui/dist');
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
      `Web UI build not found at ${distDir}. Run "npm run build --workspace @rdg/web-ui" first.`,
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
  graphData: ExplorerGraphData,
  initialDepth: number | 'all',
): Promise<string> {
  const webUiDistDir = await requireWebUiDist();
  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDirectory(outputDir);
  await fs.cp(webUiDistDir, outputDir, { recursive: true });

  const graphDataJson = serializeGraphData(graphData);
  await fs.writeFile(
    path.join(outputDir, 'graph-data.json'),
    graphDataJson,
    'utf-8',
  );

  const indexPath = path.join(outputDir, 'index.html');
  const originalIndex = await fs.readFile(indexPath, 'utf-8');
  const injectedIndex = originalIndex.replace(
    '</body>',
    `    <script>window.__GRAPH_DATA__ = ${graphDataJson}; window.__RDG_INITIAL_DEPTH__ = ${JSON.stringify(normalizeInitialDepth(initialDepth))};</script>\n  </body>`,
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
  tree: FileTreeNode | null,
  graphData: ExplorerGraphData,
  port: number,
  initialDepth: number | 'all',
): Promise<void> {
  const distDir = await requireWebUiDist();
  const treeJson = tree ? JSON.stringify(tree, null, 2) : null;
  const graphDataJson = serializeGraphData(graphData);
  const initialDepthValue = normalizeInitialDepth(initialDepth);

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    const requestPath = requestUrl.pathname;

    try {
      if (requestPath === '/api/graph-data') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(graphDataJson);
        return;
      }

      if (requestPath === '/api/tree') {
        if (!treeJson) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Tree data is only available in structure mode.');
          return;
        }

        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(treeJson);
        return;
      }

      if (requestPath === '/' || requestPath === '/index.html') {
        const indexPath = path.join(distDir, 'index.html');
        const originalIndex = await fs.readFile(indexPath, 'utf-8');
        const indexHtml = originalIndex.replace(
          '</body>',
          `    <script>window.__RDG_INITIAL_DEPTH__ = ${JSON.stringify(initialDepthValue)};</script>\n  </body>`,
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

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const url = `http://127.0.0.1:${port}?depth=${encodeURIComponent(initialDepthValue)}`;
  process.stderr.write(`Serving ${rootDir}\n`);
  process.stderr.write(`Opening ${url}\n`);

  const shutdown = () => {
    void new Promise<void>((resolve) => {
      server.close(() => resolve());
    }).finally(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

async function buildGraphData(
  rootDir: string,
  options: ScanCommandOptions,
): Promise<{ tree: FileTreeNode | null; graphData: ExplorerGraphData }> {
  const mode = parseMode(options.mode);

  if (mode === 'structure') {
    const tree = await scanFileTree(rootDir, {
      ignorePatterns: options.ignore,
    });
    const structureGraph = buildStructureGraph(tree);
    return {
      tree,
      graphData: toStructureGraphData(structureGraph),
    };
  }

  const result = await scanProject({
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
  });

  return {
    tree: null,
    graphData: toDependencyGraphData(result),
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
    .option('--html', 'Generate a static HTML export in .react-dependency-graph/')
    .option('-o, --output <file>', 'Write JSON output to a file instead of stdout')
    .option('--mode <mode>', 'Graph mode: structure | dependencies', 'structure')
    .option('--ignore <patterns...>', 'Additional directory/file patterns to ignore')
    .option('--no-circular', 'Skip circular dependency detection in dependency mode')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution in dependency mode')
    .option(
      '--extensions <exts...>',
      'File extensions to scan in dependency mode (default: .js .jsx .ts .tsx)',
    )
    .option('--depth <depth>', 'Initial visible depth: 1, 2, 3, 4, or all', '2')
    .option('--port <port>', 'Port for the local browser server', '5178')
    .option('--no-open', 'Do not open the browser automatically')
    .action(async (dir: string, rawOptions: ScanCommandOptions) => {
      try {
        const rootDir = path.resolve(dir);
        const initialDepth = parseDepth(rawOptions.depth);
        const port = parsePort(rawOptions.port);

        if (rawOptions.json && rawOptions.html) {
          throw new Error('Choose only one output mode: --json or --html.');
        }

        if (rawOptions.output && !rawOptions.json) {
          throw new Error('--output is only supported together with --json.');
        }

        await verifyDirectory(rootDir);
        process.stderr.write(`Scanning ${rootDir}...\n`);

        const { tree, graphData } = await buildGraphData(rootDir, rawOptions);

        if (rawOptions.json) {
          const output = serializeGraphData(graphData);
          if (rawOptions.output) {
            const outputPath = path.resolve(rawOptions.output);
            await ensureDirectory(path.dirname(outputPath));
            await fs.writeFile(outputPath, output, 'utf-8');
            process.stderr.write(`Output written to ${outputPath}\n`);
          } else {
            process.stdout.write(output + '\n');
          }
          return;
        }

        if (rawOptions.html) {
          const outputDir = path.join(rootDir, '.react-dependency-graph');
          const indexPath = await createStaticExport(outputDir, graphData, initialDepth);
          process.stderr.write(`Static export written to ${indexPath}\n`);
          return;
        }

        await startGraphServer(rootDir, tree, graphData, port, initialDepth);
        if (rawOptions.open !== false) {
          const url = `http://127.0.0.1:${port}?depth=${encodeURIComponent(normalizeInitialDepth(initialDepth))}`;
          await openBrowser(url);
        }

        await new Promise<void>(() => undefined);
      } catch (err) {
        console.error(`Scan failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
