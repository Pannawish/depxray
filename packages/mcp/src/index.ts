#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import packageJson from '../package.json';
import { findCircularTool } from './tools/findCircular.js';
import { findOrphansTool } from './tools/findOrphans.js';
import { getFileTreeTool } from './tools/getFileTree.js';
import { getFolderSummaryTool } from './tools/getFolderSummary.js';
import { inspectFileTool } from './tools/inspectFile.js';
import { scanProjectTool } from './tools/scanProject.js';
import { jsonContent } from './tools/shared.js';

const rootDirSchema = z.string().min(1).describe('Absolute or relative project root directory.');

export function createDepxrayMcpServer(): McpServer {
  const server = new McpServer({
    name: 'depxray',
    version: packageJson.version,
  });

  server.registerTool(
    'scan_project',
    {
      title: 'Scan project',
      description: 'Scan a project and return graph data for structure or dependency analysis.',
      inputSchema: {
        rootDir: rootDirSchema,
        mode: z.enum(['structure', 'dependencies']).optional().describe('Graph mode to return. Defaults to dependencies.'),
      },
    },
    async (input) => jsonContent(await scanProjectTool(input)),
  );

  server.registerTool(
    'inspect_file',
    {
      title: 'Inspect file',
      description: 'Return imports, dependents, and dependency metrics for one project file.',
      inputSchema: {
        filePath: z.string().min(1).describe('File path to inspect. Relative paths resolve from rootDir.'),
        rootDir: rootDirSchema.optional().describe('Project root directory. Defaults to the MCP process working directory.'),
      },
    },
    async (input) => jsonContent(await inspectFileTool(input)),
  );

  server.registerTool(
    'find_circular',
    {
      title: 'Find circular dependencies',
      description: 'Find circular dependency chains in a project.',
      inputSchema: {
        rootDir: rootDirSchema,
      },
    },
    async (input) => jsonContent(await findCircularTool(input)),
  );

  server.registerTool(
    'find_orphans',
    {
      title: 'Find orphan files',
      description: 'Find source files with no inbound dependency references, excluding configured entry points.',
      inputSchema: {
        rootDir: rootDirSchema,
        entryPointPatterns: z.array(z.string().min(1)).optional().describe('Optional glob patterns to exclude entry points from orphan results.'),
      },
    },
    async (input) => jsonContent(await findOrphansTool(input)),
  );

  server.registerTool(
    'get_file_tree',
    {
      title: 'Get file tree',
      description: 'Return the project file tree, optionally limited by traversal depth.',
      inputSchema: {
        rootDir: rootDirSchema,
        maxDepth: z.number().int().nonnegative().optional().describe('Maximum folder depth to scan.'),
      },
    },
    async (input) => jsonContent(await getFileTreeTool(input)),
  );

  server.registerTool(
    'get_folder_summary',
    {
      title: 'Get folder summary',
      description: 'Return dependency metrics for a folder, including internal, incoming, outgoing, circular, and orphan references.',
      inputSchema: {
        rootDir: rootDirSchema,
        folderPath: z.string().min(1).describe('Folder path to summarize. Relative paths resolve from rootDir.'),
      },
    },
    async (input) => jsonContent(await getFolderSummaryTool(input)),
  );

  return server;
}

async function main(): Promise<void> {
  const server = createDepxrayMcpServer();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
