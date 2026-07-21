import cliPackageJson from '../../package.json';
import {
  buildStructureGraph,
  createDependencyGraphPayload,
  createStructureGraphPayload,
  GRAPH_PAYLOAD_SCHEMA_VERSION,
  ProjectScanSession,
  scanFileTree,
  scanProject,
  type ExplorerGraphData,
  type ExplorerGraphSet,
  type FileTreeNode,
  type ScanResult,
  type StructureGraph,
} from '@depxray/core';
import { createDependencyScanOptions, parseMode, type ScanCommandOptions } from './scanOptions.js';

function getGeneratedBy(): string {
  return `depxray@${cliPackageJson.version}`;
}

export function toStructureGraphData(graph: StructureGraph): ExplorerGraphData {
  return createStructureGraphPayload(graph, { generatedBy: getGeneratedBy() });
}

export function toDependencyGraphData(result: ScanResult): ExplorerGraphData {
  return createDependencyGraphPayload(result, { generatedBy: getGeneratedBy() });
}

export async function buildSelectedGraphData(
  rootDir: string,
  options: ScanCommandOptions,
): Promise<ExplorerGraphData> {
  if (parseMode(options.mode) === 'structure') {
    const tree = await scanFileTree(rootDir, { ignorePatterns: options.ignore });
    return toStructureGraphData(buildStructureGraph(tree));
  }

  const result = await scanProject(createDependencyScanOptions(rootDir, options));
  return toDependencyGraphData(result);
}

export async function buildDependencyScanResult(
  rootDir: string,
  options: ScanCommandOptions,
  scanSession?: ProjectScanSession,
): Promise<ScanResult> {
  return scanSession
    ? scanSession.scan()
    : scanProject(createDependencyScanOptions(rootDir, options));
}

export async function buildGraphSet(
  rootDir: string,
  options: ScanCommandOptions,
  scanSession?: ProjectScanSession,
): Promise<{ tree: FileTreeNode; graphSet: ExplorerGraphSet }> {
  const tree = await scanFileTree(rootDir, { ignorePatterns: options.ignore });
  const [structureGraph, dependencyResult] = await Promise.all([
    Promise.resolve(buildStructureGraph(tree)),
    buildDependencyScanResult(rootDir, options, scanSession),
  ]);
  const structure = toStructureGraphData(structureGraph);
  const dependencies = toDependencyGraphData(dependencyResult);

  return {
    tree,
    graphSet: {
      schemaVersion: GRAPH_PAYLOAD_SCHEMA_VERSION,
      generatedBy: getGeneratedBy(),
      projectRoot: rootDir,
      scannedAt: new Date().toISOString(),
      availableModes: ['structure', 'dependencies'],
      defaultMode: parseMode(options.mode),
      graphs: { structure, dependencies },
    },
  };
}
