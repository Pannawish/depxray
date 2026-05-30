import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { Command } from 'commander';
import {
  buildStructureGraph,
  scanFileTree,
  type FileTreeNode,
  type StructureGraph,
  type StructureGraphEdge,
  type StructureGraphNode,
} from '@rdg/core';

interface StructureGraphData {
  projectRoot: string;
  scannedAt: string;
  totalFiles: number;
  totalDirs: number;
  nodes: StructureGraphNode[];
  edges: StructureGraphEdge[];
}

interface ScanCommandOptions {
  json?: boolean;
  html?: boolean;
  output?: string;
  ignore?: string[];
  depth?: string;
  port?: string;
  open?: boolean;
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

function toStructureGraphData(graph: StructureGraph): StructureGraphData {
  return {
    projectRoot: graph.rootDir,
    scannedAt: new Date().toISOString(),
    totalFiles: graph.nodes.filter((node) => node.kind === 'file').length,
    totalDirs: graph.nodes.filter((node) => node.kind === 'directory').length,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

function serializeStructureGraphData(data: StructureGraphData): string {
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
  graphData: StructureGraphData,
  initialDepth: number | 'all',
): Promise<string> {
  const webUiDistDir = await requireWebUiDist();
  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDirectory(outputDir);
  await fs.cp(webUiDistDir, outputDir, { recursive: true });

  const graphDataJson = serializeStructureGraphData(graphData);
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

async function startStructureServer(
  rootDir: string,
  tree: FileTreeNode,
  graphData: StructureGraphData,
  port: number,
  initialDepth: number | 'all',
): Promise<void> {
  const distDir = await requireWebUiDist();
  const treeJson = JSON.stringify(tree, null, 2);
  const graphDataJson = serializeStructureGraphData(graphData);
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

export function createScanCommand(): Command {
  const cmd = new Command('scan')
    .description('Scan a project and open the structure graph in a local browser')
    .argument(
      '[dir]',
      'Project directory to scan (default: current directory)',
      '.',
    )
    .option('--json', 'Print the structure graph JSON to stdout')
    .option('--html', 'Generate a static HTML export in .react-dependency-graph/')
    .option('-o, --output <file>', 'Write JSON output to a file instead of stdout')
    .option('--ignore <patterns...>', 'Additional directory/file patterns to ignore')
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

        const tree = await scanFileTree(rootDir, {
          ignorePatterns: rawOptions.ignore,
        });
        const structureGraph = buildStructureGraph(tree);
        const graphData = toStructureGraphData(structureGraph);

        if (rawOptions.json) {
          const output = serializeStructureGraphData(graphData);
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

        await startStructureServer(rootDir, tree, graphData, port, initialDepth);
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
