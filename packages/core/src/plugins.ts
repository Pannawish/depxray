import type {
  DependencyGraph,
  DepxrayPlugin,
  DepxrayPluginContext,
  ScanResult,
} from './types.js';
import type { GraphDiffResult } from './diffGraphs.js';

function pluginName(plugin: DepxrayPlugin, index: number): string {
  return plugin.name ?? `plugin-${index + 1}`;
}

function setPluginData<T extends { pluginData?: Record<string, unknown> }>(
  value: T,
  key: string,
  data: unknown,
): T {
  return {
    ...value,
    pluginData: {
      ...value.pluginData,
      [key]: data,
    },
  };
}

export const complexityPlugin: DepxrayPlugin = {
  name: '@depxray/plugin-complexity',
  afterScan(result) {
    const nodes = result.graph.nodes;
    const totalLoc = nodes.reduce((sum, node) => sum + (node.metrics?.loc ?? 0), 0);
    const complexityValues = nodes.map((node) => node.metrics?.cyclomaticComplexity ?? 0);
    const maxComplexity = Math.max(0, ...complexityValues);
    const averageComplexity = nodes.length === 0
      ? 0
      : complexityValues.reduce((sum, value) => sum + value, 0) / nodes.length;
    const hotspots = [...nodes]
      .filter((node) => (node.metrics?.cyclomaticComplexity ?? 0) > 1)
      .sort((a, b) => (
        (b.metrics?.cyclomaticComplexity ?? 0) - (a.metrics?.cyclomaticComplexity ?? 0)
        || (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0)
        || a.relativePath.localeCompare(b.relativePath)
      ))
      .slice(0, 10)
      .map((node) => ({
        file: node.relativePath,
        complexity: node.metrics?.cyclomaticComplexity ?? 0,
        loc: node.metrics?.loc ?? 0,
      }));

    return setPluginData(result, 'complexity', {
      totalLoc,
      averageComplexity,
      maxComplexity,
      hotspots,
    });
  },
};

export const mcpPlugin: DepxrayPlugin = {
  name: '@depxray/plugin-mcp',
  afterScan(result) {
    return setPluginData(result, 'mcp', {
      tools: [
        'scan_project',
        'inspect_file',
        'analyze_impact',
        'find_circular',
        'find_orphans',
        'get_file_tree',
        'get_folder_summary',
        'check_health',
        'find_unused_exports',
        'explain_dependency_chain',
        'find_related_files',
        'suggest_cleanup',
        'diff_graphs',
      ],
      summary: {
        files: result.totalFiles,
        imports: result.totalImports,
        circularChains: result.circularCount,
        orphanFiles: result.orphanFiles.length,
      },
    });
  },
};

export const githubPrPlugin: DepxrayPlugin = {
  name: '@depxray/plugin-github-pr',
  async onReport(data) {
    const diff = data as GraphDiffResult;
    const lines: string[] = ['## depxray Dependency Report', ''];

    if (diff.addedFiles.length > 0) {
      lines.push(`### Added files (${diff.addedFiles.length})`);
      for (const file of diff.addedFiles.slice(0, 10)) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    if (diff.removedFiles.length > 0) {
      lines.push(`### Removed files (${diff.removedFiles.length})`);
      for (const file of diff.removedFiles.slice(0, 10)) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    if (diff.addedEdges.length > 0) {
      lines.push(`### Added dependency edges (${diff.addedEdges.length})`);
      for (const edge of diff.addedEdges.slice(0, 10)) {
        lines.push(`- \`${edge.source}\` -> \`${edge.target}\``);
      }
      lines.push('');
    }

    if (diff.removedEdges.length > 0) {
      lines.push(`### Removed dependency edges (${diff.removedEdges.length})`);
      for (const edge of diff.removedEdges.slice(0, 10)) {
        lines.push(`- \`${edge.source}\` -> \`${edge.target}\``);
      }
      lines.push('');
    }

    if (diff.addedCircularDependencies.length > 0) {
      lines.push(`### New circular dependencies (${diff.addedCircularDependencies.length})`);
      for (const chain of diff.addedCircularDependencies) {
        lines.push(`- ${chain}`);
      }
      lines.push('');
    }

    if (diff.removedCircularDependencies.length > 0) {
      lines.push(`### Resolved circular dependencies (${diff.removedCircularDependencies.length})`);
      for (const chain of diff.removedCircularDependencies) {
        lines.push(`- ${chain}`);
      }
      lines.push('');
    }

    if (lines.length === 2) {
      lines.push('No dependency graph changes detected.');
    }

    return {
      ...diff,
      markdownComment: lines.join('\n').trimEnd(),
    };
  },
};

export const BUILT_IN_PLUGINS: Record<string, DepxrayPlugin> = {
  '@depxray/plugin-complexity': complexityPlugin,
  '@depxray/plugin-mcp': mcpPlugin,
  '@depxray/plugin-github-pr': githubPrPlugin,
};

export async function runAfterBuildGraphHooks(
  graph: DependencyGraph,
  plugins: DepxrayPlugin[] = [],
  context: DepxrayPluginContext,
): Promise<DependencyGraph> {
  let nextGraph = graph;
  for (const [index, plugin] of plugins.entries()) {
    if (!plugin.afterBuildGraph) {
      continue;
    }

    try {
      nextGraph = (await plugin.afterBuildGraph(nextGraph, context)) ?? nextGraph;
    } catch (error) {
      throw new Error(`${pluginName(plugin, index)} afterBuildGraph failed: ${(error as Error).message}`);
    }
  }

  return nextGraph;
}

export async function runAfterScanHooks(
  result: ScanResult,
  plugins: DepxrayPlugin[] = [],
  context: DepxrayPluginContext,
): Promise<ScanResult> {
  let nextResult = result;
  for (const [index, plugin] of plugins.entries()) {
    if (!plugin.afterScan) {
      continue;
    }

    try {
      nextResult = (await plugin.afterScan(nextResult, context)) ?? nextResult;
    } catch (error) {
      throw new Error(`${pluginName(plugin, index)} afterScan failed: ${(error as Error).message}`);
    }
  }

  return nextResult;
}

export async function runReportHooks(
  data: unknown,
  plugins: DepxrayPlugin[] = [],
  context: DepxrayPluginContext,
): Promise<unknown> {
  let nextData = data;
  for (const [index, plugin] of plugins.entries()) {
    if (!plugin.onReport) {
      continue;
    }

    try {
      nextData = (await plugin.onReport(nextData, context)) ?? nextData;
    } catch (error) {
      throw new Error(`${pluginName(plugin, index)} onReport failed: ${(error as Error).message}`);
    }
  }

  return nextData;
}
