import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStructureGraph,
  createDependencyGraphPayload,
  createStructureGraphPayload,
  scanFileTree,
  scanProject,
  type ExplorerGraphSet,
} from '@depxray/core';
import { startGraphServer, type GraphServerHandle } from '../src/commands/scan.js';

const SIMPLE_PROJECT = path.resolve(__dirname, '../../core/__tests__/fixtures/simple-project');

describe('browser graph server', () => {
  let server: GraphServerHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('serves graph, tree, source, and UI endpoints', async () => {
    const tree = await scanFileTree(SIMPLE_PROJECT);
    const structureGraph = buildStructureGraph(tree, 3);
    const dependencyResult = await scanProject({ rootDir: SIMPLE_PROJECT });
    const structure = createStructureGraphPayload(structureGraph, { generatedBy: 'e2e-test' });
    const dependencies = createDependencyGraphPayload(dependencyResult, {
      generatedBy: 'e2e-test',
    });
    const graphSet: ExplorerGraphSet = {
      schemaVersion: structure.schemaVersion,
      generatedBy: 'e2e-test',
      projectRoot: SIMPLE_PROJECT,
      scannedAt: structure.scannedAt,
      availableModes: ['structure', 'dependencies'],
      defaultMode: 'structure',
      graphs: { structure, dependencies },
    };

    server = await startGraphServer(SIMPLE_PROJECT, tree, graphSet, 32178, 3);
    const baseUrl = `http://127.0.0.1:${server.port}`;

    const [pageResponse, graphResponse, treeResponse, fileResponse, forbiddenResponse] =
      await Promise.all([
        fetch(baseUrl),
        fetch(`${baseUrl}/api/graph-set`),
        fetch(`${baseUrl}/api/tree`),
        fetch(`${baseUrl}/api/file?path=${encodeURIComponent('src/App.tsx')}`),
        fetch(`${baseUrl}/api/file?path=${encodeURIComponent('../package.json')}`),
      ]);

    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('window.__DEPXRAY_INITIAL_MODE__ = "structure"');
    expect(graphResponse.status).toBe(200);
    expect(await graphResponse.json()).toMatchObject({
      schemaVersion: '1.0.0',
      defaultMode: 'structure',
    });
    expect(treeResponse.status).toBe(200);
    expect(await treeResponse.json()).toMatchObject({ relativePath: '.' });
    expect(fileResponse.status).toBe(200);
    expect(await fileResponse.text()).toContain('function App');
    expect(forbiddenResponse.status).toBe(403);
  });
});
