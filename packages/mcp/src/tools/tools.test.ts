import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCircularTool } from './findCircular.js';
import { findOrphansTool } from './findOrphans.js';
import { getFileTreeTool } from './getFileTree.js';
import { getFolderSummaryTool } from './getFolderSummary.js';
import { inspectFileTool } from './inspectFile.js';
import { scanProjectTool } from './scanProject.js';

const FIXTURES_DIR = path.resolve(__dirname, '../../../core/__tests__/fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const CIRCULAR_PROJECT = path.join(FIXTURES_DIR, 'circular-project');

describe('MCP tool handlers', () => {
  it('returns dependency graph data for scan_project', async () => {
    const result = await scanProjectTool({
      rootDir: SIMPLE_PROJECT,
      mode: 'dependencies',
    });

    expect(result.mode).toBe('dependencies');
    expect(result.totalFiles).toBe(7);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.orphanFiles).toEqual([]);
  });

  it('returns structure graph data for scan_project', async () => {
    const result = await scanProjectTool({
      rootDir: SIMPLE_PROJECT,
      mode: 'structure',
    });

    expect(result.mode).toBe('structure');
    expect(result.totalFiles).toBeGreaterThan(0);
    expect(result.totalDirs).toBeGreaterThan(0);
    expect(result.edges.every((edge) => edge.kind === 'structure')).toBe(true);
  });

  it('inspects one file imports and dependents', async () => {
    const result = await inspectFileTool({
      rootDir: SIMPLE_PROJECT,
      filePath: 'src/App.tsx',
    });

    expect(result.file).toBe('src/App.tsx');
    expect(result.imports.map((item) => item.file)).toContain('src/components/Header.tsx');
    expect(result.imports.map((item) => item.file)).toContain('src/components/Footer.tsx');
    expect(result.isOrphan).toBe(false);
  });

  it('finds circular dependency chains', async () => {
    const result = await findCircularTool({ rootDir: CIRCULAR_PROJECT });

    expect(result.count).toBeGreaterThanOrEqual(2);
    expect(result.chains.length).toBe(result.count);
  });

  it('finds orphan files', async () => {
    const result = await findOrphansTool({ rootDir: CIRCULAR_PROJECT });

    expect(result.count).toBeGreaterThan(0);
    expect(result.orphanFiles).toContain('src/standalone.ts');
  });

  it('returns a bounded file tree', async () => {
    const result = await getFileTreeTool({
      rootDir: SIMPLE_PROJECT,
      maxDepth: 1,
    });

    expect(result.kind).toBe('directory');
    expect(result.absolutePath).toBe(SIMPLE_PROJECT);
    expect(result.children.map((child) => child.name)).toContain('src');
  });

  it('summarizes dependency metrics for a folder', async () => {
    const result = await getFolderSummaryTool({
      rootDir: SIMPLE_PROJECT,
      folderPath: 'src',
    });

    expect(result.folder).toBe('src');
    expect(result.totalFiles).toBe(7);
    expect(result.internalImports).toBeGreaterThan(0);
    expect(result.circularFiles).toEqual([]);
  });
});
