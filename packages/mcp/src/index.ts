#!/usr/bin/env node

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeImpactTool } from './tools/analyzeImpact.js';
import { checkHealthTool } from './tools/checkHealth.js';
import { diffGraphsTool } from './tools/diffGraphs.js';
import { explainDependencyChainTool } from './tools/explainDependencyChain.js';
import { findCircularTool } from './tools/findCircular.js';
import { findOrphansTool } from './tools/findOrphans.js';
import { findRelatedFilesTool } from './tools/findRelatedFiles.js';
import { findUnusedExportsTool } from './tools/findUnusedExports.js';
import { getFileTreeTool } from './tools/getFileTree.js';
import { getFolderSummaryTool } from './tools/getFolderSummary.js';
import { inspectFileTool } from './tools/inspectFile.js';
import { scanProjectTool } from './tools/scanProject.js';
import { suggestCleanupTool } from './tools/suggestCleanup.js';
import { jsonContent } from './tools/shared.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const rootDirSchema = z.string().min(1).describe('Absolute or relative project root directory.');

export function createDepxrayMcpServer(): McpServer {
  const server = new McpServer({
    name: 'depxray',
    version: packageJson.version,
  });

  server.registerTool(
    'check_health',
    {
      title: 'Check project health',
      description:
        'Return a health scorecard with grade, issue counts, complexity hotspots, and dependency hubs.',
      inputSchema: {
        rootDir: rootDirSchema,
      },
    },
    async (input) => jsonContent(await checkHealthTool(input)),
  );

  server.registerTool(
    'find_unused_exports',
    {
      title: 'Find unused exports',
      description:
        'Find exports that are never imported by any other file in the project. Optionally filter to a single file.',
      inputSchema: {
        rootDir: rootDirSchema,
        filePath: z
          .string()
          .min(1)
          .optional()
          .describe('Optional file path to limit results to a single file.'),
      },
    },
    async (input) => jsonContent(await findUnusedExportsTool(input)),
  );

  server.registerTool(
    'explain_dependency_chain',
    {
      title: 'Explain dependency chain',
      description:
        'Find and explain the import chain between two files. Shows all shortest dependency paths from one file to another.',
      inputSchema: {
        from: z
          .string()
          .min(1)
          .describe('Source file path. The file that imports directly or transitively.'),
        to: z.string().min(1).describe('Target file path. The file being imported.'),
        rootDir: rootDirSchema
          .optional()
          .describe('Project root directory. Defaults to the MCP process working directory.'),
      },
    },
    async (input) => jsonContent(await explainDependencyChainTool(input)),
  );

  server.registerTool(
    'find_related_files',
    {
      title: 'Find related files',
      description:
        'Find files related to a given file: direct imports, dependents, directory siblings, and co-located files sharing the same name stem.',
      inputSchema: {
        filePath: z
          .string()
          .min(1)
          .describe('File path to find related files for. Relative paths resolve from rootDir.'),
        rootDir: rootDirSchema
          .optional()
          .describe('Project root directory. Defaults to the MCP process working directory.'),
      },
    },
    async (input) => jsonContent(await findRelatedFilesTool(input)),
  );

  server.registerTool(
    'suggest_cleanup',
    {
      title: 'Suggest cleanup actions',
      description:
        'Return confidence-rated cleanup suggestions with evidence and false-positive caveats for orphan files, unused exports, unresolved imports, unused dependencies, and circular dependencies.',
      inputSchema: {
        rootDir: rootDirSchema,
        maxSuggestions: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of suggestions to return. Default 10.'),
      },
    },
    async (input) => jsonContent(await suggestCleanupTool(input)),
  );

  server.registerTool(
    'diff_graphs',
    {
      title: 'Diff dependency graphs',
      description:
        'Compare the current dependency graph against a git base ref. Shows added/removed files, edges, and circular dependency changes.',
      inputSchema: {
        rootDir: rootDirSchema,
        baseRef: z
          .string()
          .min(1)
          .describe('Git ref to compare against, for example main or HEAD~1.'),
      },
    },
    async (input) => jsonContent(await diffGraphsTool(input)),
  );

  server.registerTool(
    'analyze_impact',
    {
      title: 'Analyze dependency impact',
      description:
        'Analyze the blast radius of changing a file by returning direct and transitive dependents, paths, complexity metrics, and risk signals.',
      inputSchema: {
        filePath: z
          .string()
          .min(1)
          .describe('File path to analyze. Relative paths resolve from rootDir.'),
        rootDir: rootDirSchema
          .optional()
          .describe('Project root directory. Defaults to the MCP process working directory.'),
        complexityThreshold: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Complexity score considered high.'),
        impactThreshold: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Transitive dependent count considered high-impact.'),
        inboundThreshold: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Incoming import count considered high-impact.'),
      },
    },
    async (input) => jsonContent(await analyzeImpactTool(input)),
  );

  server.registerTool(
    'scan_project',
    {
      title: 'Scan project',
      description: 'Scan a project and return graph data for structure or dependency analysis.',
      inputSchema: {
        rootDir: rootDirSchema,
        mode: z
          .enum(['structure', 'dependencies'])
          .optional()
          .describe('Graph mode to return. Defaults to dependencies.'),
        prodEntryPoints: z
          .array(z.string().min(1))
          .optional()
          .describe('Production entry point patterns for devDependency checks.'),
        devEntryPoints: z
          .array(z.string().min(1))
          .optional()
          .describe('Development entry point patterns excluded from production checks.'),
        ignoreTypeImports: z
          .boolean()
          .optional()
          .describe('Ignore type-only imports for devDependency production checks.'),
        importConventions: z
          .object({
            prefer: z.enum(['relative', 'absolute']).optional(),
            aliasPrefix: z.string().min(1).optional(),
            root: z.string().min(1).optional(),
          })
          .optional()
          .describe('Internal import convention to enforce.'),
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
        filePath: z
          .string()
          .min(1)
          .describe('File path to inspect. Relative paths resolve from rootDir.'),
        rootDir: rootDirSchema
          .optional()
          .describe('Project root directory. Defaults to the MCP process working directory.'),
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
      description:
        'Find source files with no inbound dependency references, excluding configured entry points.',
      inputSchema: {
        rootDir: rootDirSchema,
        entryPointPatterns: z
          .array(z.string().min(1))
          .optional()
          .describe('Optional glob patterns to exclude entry points from orphan results.'),
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
        maxDepth: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe('Maximum folder depth to scan.'),
      },
    },
    async (input) => jsonContent(await getFileTreeTool(input)),
  );

  server.registerTool(
    'get_folder_summary',
    {
      title: 'Get folder summary',
      description:
        'Return dependency metrics for a folder, including internal, incoming, outgoing, circular, and orphan references.',
      inputSchema: {
        rootDir: rootDirSchema,
        folderPath: z
          .string()
          .min(1)
          .describe('Folder path to summarize. Relative paths resolve from rootDir.'),
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
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(message);
    process.exit(1);
  });
}
