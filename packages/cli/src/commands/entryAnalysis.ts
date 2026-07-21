import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { loadPlugins } from '../plugins.js';
import {
  loadConfig,
  matchesAnyPattern,
  scanProject,
  type DepxrayConfig,
  type DepxrayPlugin,
  type GraphEdge,
  type GraphNode,
} from '@depxray/core';

interface BaseOptions {
  dir?: string;
  json?: boolean;
  format?: string;
  ignore?: string[];
  extensions?: string[];
  aliases?: boolean;
  circular?: boolean;
  plugins?: DepxrayPlugin[];
}

interface EntryPointOptions extends BaseOptions {
  exclude?: string[];
}

interface TraceOptions extends BaseOptions {
  compact?: boolean;
}

type OptionSourceReader = (name: string) => string | undefined;

function cliOptionWasProvided(getOptionSource: OptionSourceReader, name: string): boolean {
  return getOptionSource(name) === 'cli';
}

function mergeOptionsWithConfig<TOptions extends BaseOptions>(
  rawOptions: TOptions,
  config: DepxrayConfig,
  getOptionSource: OptionSourceReader,
): TOptions {
  return {
    ...rawOptions,
    ignore: cliOptionWasProvided(getOptionSource, 'ignore')
      ? rawOptions.ignore
      : (config.ignore ?? rawOptions.ignore),
    aliases: cliOptionWasProvided(getOptionSource, 'aliases')
      ? rawOptions.aliases
      : (config.aliases ?? rawOptions.aliases),
    circular: cliOptionWasProvided(getOptionSource, 'circular')
      ? rawOptions.circular
      : (config.circular ?? rawOptions.circular),
    extensions: cliOptionWasProvided(getOptionSource, 'extensions')
      ? rawOptions.extensions
      : (config.extensions ?? rawOptions.extensions),
    plugins: rawOptions.plugins,
  };
}

function parseFormat(format: string | undefined): 'text' | 'json' {
  if (!format || format === 'text') {
    return 'text';
  }
  if (format === 'json') {
    return 'json';
  }
  throw new Error(`Invalid format: ${format}. Use "text" or "json".`);
}

async function verifyDirectory(rootDir: string): Promise<void> {
  const stat = await fs.stat(rootDir);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }
}

function adjacency(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const map = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const current = map.get(edge.source);
    if (current) {
      current.push(edge);
    } else {
      map.set(edge.source, [edge]);
    }
  }
  return map;
}

function reverseAdjacency(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const map = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const current = map.get(edge.target);
    if (current) {
      current.push(edge);
    } else {
      map.set(edge.target, [edge]);
    }
  }
  return map;
}

function findEntryPointNodes(nodes: GraphNode[], exclude: string[] = []): GraphNode[] {
  return nodes
    .filter((node) => node.inDegree === 0)
    .filter((node) => !matchesAnyPattern(node.relativePath, exclude))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function resolveProjectFile(rootDir: string, file: string): string {
  return path.isAbsolute(file) ? path.resolve(file) : path.resolve(rootDir, file);
}

async function scan(rootDir: string, options: BaseOptions) {
  return scanProject({
    rootDir,
    ignorePatterns: options.ignore,
    detectCircular: options.circular !== false,
    resolveAliases: options.aliases !== false,
    extensions: options.extensions,
    plugins: options.plugins,
  });
}

export function createEntryPointsCommand(): Command {
  const cmd = new Command('entry-points')
    .description('List files with no incoming imports')
    .argument('[dir]', 'Project directory to scan', '.')
    .option('--exclude <patterns...>', 'Entry point patterns to exclude from output')
    .option('--json', 'Print machine-readable JSON')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--ignore <patterns...>', 'Additional patterns to ignore')
    .option('--extensions <exts...>', 'File extensions to scan')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .action(async (dir: string, rawOptions: EntryPointOptions) => {
      try {
        const rootDir = path.resolve(dir);
        await verifyDirectory(rootDir);
        const config = await loadConfig(rootDir);
        const options = mergeOptionsWithConfig(rawOptions, config, (name) =>
          cmd.getOptionValueSource(name),
        );
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const format = rawOptions.json ? 'json' : parseFormat(options.format);
        const result = await scan(rootDir, options);
        const entryPoints = findEntryPointNodes(result.graph.nodes, options.exclude).map(
          (node) => ({
            file: node.relativePath,
            inDegree: node.inDegree,
            outDegree: node.outDegree,
          }),
        );

        if (format === 'json') {
          process.stdout.write(JSON.stringify({ entryPoints }, null, 2) + '\n');
          return;
        }

        if (entryPoints.length === 0) {
          process.stdout.write('No entry points found.\n');
          return;
        }
        process.stdout.write(`Entry points (${entryPoints.length}):\n`);
        for (const entryPoint of entryPoints) {
          process.stdout.write(`  ${entryPoint.file} (${entryPoint.outDegree} imports)\n`);
        }
      } catch (err) {
        console.error(`entry-points failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}

export function createTraceCommand(): Command {
  const cmd = new Command('trace')
    .description('Show which entry points depend on a file')
    .argument('<file>', 'Target file to trace')
    .argument('[dir]', 'Project directory to scan', '.')
    .option('--compact', 'Print only entry point summaries')
    .option('--json', 'Print machine-readable JSON')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--ignore <patterns...>', 'Additional patterns to ignore')
    .option('--extensions <exts...>', 'File extensions to scan')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .action(async (file: string, dir: string, rawOptions: TraceOptions) => {
      try {
        const rootDir = path.resolve(dir);
        await verifyDirectory(rootDir);
        const config = await loadConfig(rootDir);
        const options = mergeOptionsWithConfig(rawOptions, config, (name) =>
          cmd.getOptionValueSource(name),
        );
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const format = rawOptions.json ? 'json' : parseFormat(options.format);
        const result = await scan(rootDir, options);
        const targetPath = resolveProjectFile(rootDir, file);
        const target = result.graph.nodes.find((node) => node.id === targetPath);
        if (!target) {
          throw new Error(`File not found in dependency graph: ${file}`);
        }

        const reverse = reverseAdjacency(result.graph.edges);
        const entries = new Set(findEntryPointNodes(result.graph.nodes).map((node) => node.id));
        const paths: string[][] = [];
        const stack: Array<{ nodeId: string; path: string[] }> = [
          { nodeId: target.id, path: [target.relativePath] },
        ];

        while (stack.length > 0 && paths.length < 100) {
          const current = stack.pop()!;
          if (entries.has(current.nodeId)) {
            paths.push([...current.path].reverse());
            continue;
          }

          for (const edge of reverse.get(current.nodeId) ?? []) {
            const parent = result.graph.nodes.find((node) => node.id === edge.source);
            if (!parent || current.path.includes(parent.relativePath)) {
              continue;
            }
            stack.push({ nodeId: edge.source, path: [...current.path, parent.relativePath] });
          }
        }

        const entryPoints = [...new Set(paths.map((item) => item[0]))].sort();
        if (format === 'json') {
          process.stdout.write(
            JSON.stringify({ file: target.relativePath, entryPoints, paths }, null, 2) + '\n',
          );
          return;
        }

        process.stdout.write(
          `${target.relativePath} is reached by ${entryPoints.length} entry point(s).\n`,
        );
        if (options.compact) {
          for (const entryPoint of entryPoints) {
            process.stdout.write(`  ${entryPoint}\n`);
          }
          return;
        }
        for (const tracePath of paths) {
          process.stdout.write(`  ${tracePath.join(' -> ')}\n`);
        }
      } catch (err) {
        console.error(`trace failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}

interface TreeNode {
  file: string;
  imports: TreeNode[];
}

function buildImportTree(
  rootDir: string,
  node: GraphNode,
  nodesById: Map<string, GraphNode>,
  edgesBySource: Map<string, GraphEdge[]>,
  visited = new Set<string>(),
): TreeNode {
  if (visited.has(node.id)) {
    return { file: node.relativePath, imports: [] };
  }
  visited.add(node.id);
  return {
    file: node.relativePath,
    imports: (edgesBySource.get(node.id) ?? [])
      .map((edge) => nodesById.get(edge.target))
      .filter((child): child is GraphNode => Boolean(child))
      .map((child) => buildImportTree(rootDir, child, nodesById, edgesBySource, new Set(visited))),
  };
}

function printTree(node: TreeNode, depth = 0): string {
  const lines = [`${'  '.repeat(depth)}${node.file}`];
  for (const child of node.imports) {
    lines.push(printTree(child, depth + 1));
  }
  return lines.join('\n');
}

export function createTreeCommand(): Command {
  const cmd = new Command('tree')
    .description('Show the transitive import tree for an entry point')
    .argument('<entry-point>', 'Entry point file to expand')
    .argument('[dir]', 'Project directory to scan', '.')
    .option('--json', 'Print machine-readable JSON')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--ignore <patterns...>', 'Additional patterns to ignore')
    .option('--extensions <exts...>', 'File extensions to scan')
    .option('--no-circular', 'Skip circular dependency detection')
    .option('--no-aliases', 'Skip tsconfig/jsconfig path alias resolution')
    .action(async (entryPoint: string, dir: string, rawOptions: BaseOptions) => {
      try {
        const rootDir = path.resolve(dir);
        await verifyDirectory(rootDir);
        const config = await loadConfig(rootDir);
        const options = mergeOptionsWithConfig(rawOptions, config, (name) =>
          cmd.getOptionValueSource(name),
        );
        options.plugins = await loadPlugins(config.plugins, rootDir);
        const format = rawOptions.json ? 'json' : parseFormat(options.format);
        const result = await scan(rootDir, options);
        const entryPath = resolveProjectFile(rootDir, entryPoint);
        const entryNode = result.graph.nodes.find((node) => node.id === entryPath);
        if (!entryNode) {
          throw new Error(`Entry point not found in dependency graph: ${entryPoint}`);
        }

        const nodesById = new Map(result.graph.nodes.map((node) => [node.id, node]));
        const tree = buildImportTree(rootDir, entryNode, nodesById, adjacency(result.graph.edges));
        if (format === 'json') {
          process.stdout.write(JSON.stringify(tree, null, 2) + '\n');
        } else {
          process.stdout.write(printTree(tree) + '\n');
        }
      } catch (err) {
        console.error(`tree failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
