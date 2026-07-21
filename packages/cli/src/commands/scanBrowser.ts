import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ExplorerGraphSet, FileTreeNode } from '@depxray/core';
import { parseMode } from './scanOptions.js';
import { ensureDirectory, serializeGraphData, serializeGraphSet } from './scanOutput.js';

const MAX_PORT_SEARCH_ATTEMPTS = 10;

export interface GraphServerHandle {
  port: number;
  updateData(nextData: { tree: FileTreeNode; graphSet: ExplorerGraphSet }): void;
  close(): Promise<void>;
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
          throw new Error(`No available port found between ${requestedPort} and ${upperBound}.`);
        }
        throw error;
      }
    }
  }
  throw new Error(`No available port found between ${requestedPort} and ${upperBound}.`);
}

function getWebUiDistDir(): string {
  const candidates = [
    path.resolve(__dirname, 'web-ui'),
    path.resolve(__dirname, '../../web-ui'),
    path.resolve(__dirname, '../web-ui/dist'),
    path.resolve(__dirname, '../../../web-ui/dist'),
  ];
  return (
    candidates.find((candidate) => {
      try {
        return statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    }) ?? candidates[0]
  );
}

async function requireWebUiDist(): Promise<string> {
  const directory = getWebUiDistDir();
  try {
    if (!(await fs.stat(directory)).isDirectory()) throw new Error();
    return directory;
  } catch {
    throw new Error(
      `Web UI build not found at ${directory}. Run "npm run build --workspace @depxray/web-ui" first.`,
    );
  }
}

function inferContentType(filePath: string): string {
  const contentTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return contentTypes[path.extname(filePath)] ?? 'application/octet-stream';
}

export function normalizeInitialDepth(depth: number | 'all'): string {
  return depth === 'all' ? 'all' : String(depth);
}

export async function createStaticExport(
  outputDir: string,
  graphSet: ExplorerGraphSet,
  initialDepth: number | 'all',
): Promise<string> {
  const webUiDistDir = await requireWebUiDist();
  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDirectory(outputDir);
  await fs.cp(webUiDistDir, outputDir, { recursive: true });

  const graphSetJson = serializeGraphSet(graphSet);
  await fs.writeFile(path.join(outputDir, 'graph-data.json'), graphSetJson, 'utf-8');
  const indexPath = path.join(outputDir, 'index.html');
  const indexHtml = (await fs.readFile(indexPath, 'utf-8')).replace(
    '</body>',
    `    <script>window.__GRAPH_DATA_SET__ = ${graphSetJson}; window.__DEPXRAY_INITIAL_DEPTH__ = ${JSON.stringify(normalizeInitialDepth(initialDepth))}; window.__DEPXRAY_INITIAL_MODE__ = ${JSON.stringify(graphSet.defaultMode)};</script>\n  </body>`,
  );
  await fs.writeFile(indexPath, indexHtml, 'utf-8');
  return indexPath;
}

export async function openBrowser(url: string): Promise<void> {
  const [command, args] =
    process.platform === 'darwin'
      ? (['open', [url]] as const)
      : process.platform === 'win32'
        ? (['cmd', ['/c', 'start', '', url]] as const)
        : (['xdg-open', [url]] as const);
  const child = spawn(command, [...args], { detached: true, stdio: 'ignore' });
  child.unref();
}

function isInsideDirectory(directory: string, targetPath: string): boolean {
  const relative = path.relative(directory, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readStaticAsset(
  distDir: string,
  requestPath: string,
): Promise<{ body: Buffer; contentType: string }> {
  const filePath = path.resolve(distDir, `.${requestPath === '/' ? '/index.html' : requestPath}`);
  if (!isInsideDirectory(distDir, filePath)) throw new Error('Forbidden');
  return { body: await fs.readFile(filePath), contentType: inferContentType(filePath) };
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
  let treeJson = JSON.stringify(tree, null, 2);
  let graphSetJson = serializeGraphSet(graphSet);
  const initialDepthValue = normalizeInitialDepth(initialDepth);
  const liveServer = new WebSocketServer({ noServer: true });

  function liveMessage(): string {
    return JSON.stringify({ type: 'graph-set', graphSet: currentGraphSet });
  }
  function sendLiveMessage(client: WebSocket): void {
    if (client.readyState === client.OPEN) client.send(liveMessage());
  }
  function broadcast(): void {
    liveServer.clients.forEach(sendLiveMessage);
  }

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    try {
      if (requestUrl.pathname === '/api/graph-set') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(graphSetJson);
        return;
      }
      if (requestUrl.pathname === '/api/graph-data') {
        const mode = parseMode(requestUrl.searchParams.get('mode') ?? currentGraphSet.defaultMode);
        const graph = currentGraphSet.graphs[mode];
        if (!graph) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end(`Graph mode not available: ${mode}`);
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(serializeGraphData(graph));
        return;
      }
      if (requestUrl.pathname === '/api/tree') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(treeJson);
        return;
      }
      if (requestUrl.pathname === '/api/file') {
        const requestedPath = requestUrl.searchParams.get('path');
        if (!requestedPath) {
          response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('Missing path parameter');
          return;
        }
        const filePath = path.resolve(rootDir, requestedPath);
        if (!isInsideDirectory(rootDir, filePath)) {
          response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('Forbidden');
          return;
        }
        try {
          response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
          response.end(await fs.readFile(filePath, 'utf-8'));
        } catch {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('File not found');
        }
        return;
      }
      if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
        const original = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
        const html = original.replace(
          '</body>',
          `    <script>window.__DEPXRAY_INITIAL_DEPTH__ = ${JSON.stringify(initialDepthValue)}; window.__DEPXRAY_INITIAL_MODE__ = ${JSON.stringify(currentGraphSet.defaultMode)};</script>\n  </body>`,
        );
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(html);
        return;
      }
      const asset = await readStaticAsset(distDir, requestUrl.pathname);
      response.writeHead(200, { 'content-type': asset.contentType });
      response.end(asset.body);
    } catch (error) {
      const forbidden = error instanceof Error && error.message === 'Forbidden';
      response.writeHead(forbidden ? 403 : 404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(forbidden ? 'Forbidden' : 'Not found');
    }
  });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    if (requestUrl.pathname !== '/api/live') {
      socket.destroy();
      return;
    }
    liveServer.handleUpgrade(request, socket, head, (client) => {
      liveServer.emit('connection', client, request);
    });
  });
  liveServer.on('connection', sendLiveMessage);

  const port = await listenOnAvailablePort(server, requestedPort);
  process.stderr.write(`Serving ${rootDir}\n`);
  if (port !== requestedPort)
    process.stderr.write(`Port ${requestedPort} is in use. Using ${port} instead.\n`);
  process.stderr.write(
    `Opening http://127.0.0.1:${port}?depth=${encodeURIComponent(initialDepthValue)}&mode=${encodeURIComponent(currentGraphSet.defaultMode)}\n`,
  );

  return {
    port,
    updateData(nextData) {
      currentTree = nextData.tree;
      currentGraphSet = nextData.graphSet;
      treeJson = JSON.stringify(currentTree, null, 2);
      graphSetJson = serializeGraphSet(currentGraphSet);
      broadcast();
    },
    async close() {
      liveServer.clients.forEach((client) => client.close());
      await new Promise<void>((resolve) => liveServer.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
