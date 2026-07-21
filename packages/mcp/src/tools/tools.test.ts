import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeImpactTool } from './analyzeImpact.js';
import { checkHealthTool } from './checkHealth.js';
import { diffGraphsTool } from './diffGraphs.js';
import { explainDependencyChainTool } from './explainDependencyChain.js';
import { findCircularTool } from './findCircular.js';
import { findOrphansTool } from './findOrphans.js';
import { findRelatedFilesTool } from './findRelatedFiles.js';
import { findUnusedExportsTool } from './findUnusedExports.js';
import { getFileTreeTool } from './getFileTree.js';
import { getFolderSummaryTool } from './getFolderSummary.js';
import { inspectFileTool } from './inspectFile.js';
import { scanProjectTool } from './scanProject.js';
import { suggestCleanupTool } from './suggestCleanup.js';

const FIXTURES_DIR = path.resolve(__dirname, '../../../core/__tests__/fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const CIRCULAR_PROJECT = path.join(FIXTURES_DIR, 'circular-project');

function createTempProject(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeText(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

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
    expect(result.nodes.some((node) => node.metrics?.loc && node.metrics.loc > 0)).toBe(true);
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
    expect(result.metrics?.loc).toBeGreaterThan(0);
  });

  it('analyzes change impact for one file', async () => {
    const result = await analyzeImpactTool({
      rootDir: SIMPLE_PROJECT,
      filePath: 'src/utils/helpers.ts',
    });

    expect(result.target.file).toBe('src/utils/helpers.ts');
    expect(result.affectedFiles.map((item) => item.file)).toContain('src/App.tsx');
    expect(result.directDependentCount).toBeGreaterThan(0);
  });

  it('returns a health scorecard for check_health', async () => {
    const result = await checkHealthTool({ rootDir: SIMPLE_PROJECT });

    expect(result.grade).toMatch(/^[A-F]$/);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.issues).toHaveProperty('circularChains');
    expect(result.issues).toHaveProperty('orphanFiles');
    expect(result.issues).toHaveProperty('unusedExports');
    expect(result.issues).toHaveProperty('unresolvedImports');
    expect(result.hotspots).toBeInstanceOf(Array);
    expect(result.hubs).toBeInstanceOf(Array);
  });

  it('finds unused exports across the project and within one file', async () => {
    const projectDir = createTempProject('depxray-unused-exports-');

    try {
      writeText(path.join(projectDir, 'src/index.ts'), [
        "import { used } from './util';",
        'export const entryValue = used;',
        '',
      ].join('\n'));
      writeText(path.join(projectDir, 'src/util.ts'), [
        'export const used = 1;',
        'export const unused = 2;',
        '',
      ].join('\n'));

      const result = await findUnusedExportsTool({ rootDir: projectDir });
      expect(result.count).toBeGreaterThan(0);
      expect(result.unusedExports).toBeInstanceOf(Array);
      expect(result.unusedExports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: 'src/util.ts',
            exportName: 'unused',
            kind: 'named',
            line: 2,
          }),
        ]),
      );

      const filtered = await findUnusedExportsTool({
        rootDir: projectDir,
        filePath: 'src/util.ts',
      });
      expect(filtered.unusedExports.every((entry) => entry.file === 'src/util.ts')).toBe(true);
      expect(filtered.unusedExports.map((entry) => entry.exportName)).toContain('unused');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('explains a dependency chain between two connected files', async () => {
    const result = await explainDependencyChainTool({
      rootDir: SIMPLE_PROJECT,
      from: 'src/App.tsx',
      to: 'src/utils/helpers.ts',
    });

    expect(result.connected).toBe(true);
    expect(result.chains.length).toBeGreaterThan(0);
    expect(result.shortestDistance).toBeGreaterThan(0);
    expect(result.chains[0][0]).toBe('src/App.tsx');
    expect(result.chains[0][result.chains[0].length - 1]).toBe('src/utils/helpers.ts');
  });

  it('reports disconnected files in dependency chain', async () => {
    const result = await explainDependencyChainTool({
      rootDir: CIRCULAR_PROJECT,
      from: 'src/standalone.ts',
      to: 'src/moduleA.ts',
    });

    expect(result.connected).toBe(false);
    expect(result.chains).toEqual([]);
    expect(result.shortestDistance).toBe(-1);
  });

  it('finds related files for a given file', async () => {
    const result = await findRelatedFilesTool({
      rootDir: SIMPLE_PROJECT,
      filePath: 'src/App.tsx',
    });

    expect(result.file).toBe('src/App.tsx');
    expect(result.imports).toContain('src/components/Header.tsx');
    expect(result.imports).toContain('src/components/Footer.tsx');
    expect(result.dependents).toBeInstanceOf(Array);
    expect(result.siblings).toContain('src/types.ts');
    expect(result.colocated).toBeInstanceOf(Array);
  });

  it('suggests cleanup actions prioritized by safety', async () => {
    const result = await suggestCleanupTool({ rootDir: CIRCULAR_PROJECT });

    expect(result.count).toBeGreaterThan(0);
    expect(result.suggestions).toBeInstanceOf(Array);
    for (const suggestion of result.suggestions) {
      expect(suggestion).toHaveProperty('action');
      expect(suggestion).toHaveProperty('file');
      expect(suggestion).toHaveProperty('impact');
      expect(suggestion).toHaveProperty('confidence');
      expect(suggestion).toHaveProperty('reason');
      expect(suggestion.evidence.length).toBeGreaterThan(0);
      expect(suggestion.caveats.length).toBeGreaterThan(0);
      expect(['safe', 'review', 'risky']).toContain(suggestion.impact);
      expect(['high', 'medium', 'low']).toContain(suggestion.confidence);
    }

    const impacts = result.suggestions.map((suggestion) => suggestion.impact);
    const safeIndex = impacts.indexOf('safe');
    const riskyIndex = impacts.indexOf('risky');
    if (safeIndex !== -1 && riskyIndex !== -1) {
      expect(safeIndex).toBeLessThan(riskyIndex);
    }
  });

  it('diffs the current graph against a git base ref', async () => {
    const projectDir = createTempProject('depxray-diff-graphs-');

    try {
      writeText(path.join(projectDir, 'package.json'), '{"name":"depxray-diff-test","type":"module"}\n');
      writeText(path.join(projectDir, 'src/index.ts'), 'export const value = 1;\n');
      execFileSync('git', ['init'], { cwd: projectDir, stdio: 'pipe' });
      execFileSync('git', ['add', '.'], { cwd: projectDir, stdio: 'pipe' });
      execFileSync(
        'git',
        [
          '-c',
          'user.email=depxray@example.com',
          '-c',
          'user.name=depxray test',
          '-c',
          'commit.gpgsign=false',
          'commit',
          '-m',
          'initial',
        ],
        { cwd: projectDir, stdio: 'pipe' },
      );

      writeText(path.join(projectDir, 'src/helper.ts'), 'export const helper = 2;\n');
      writeText(path.join(projectDir, 'src/index.ts'), [
        "import { helper } from './helper';",
        'export const value = helper;',
        '',
      ].join('\n'));

      const result = await diffGraphsTool({
        rootDir: projectDir,
        baseRef: 'HEAD',
      });

      expect(result.addedFiles).toContain('src/helper.ts');
      expect(result.addedEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'src/index.ts',
            target: 'src/helper.ts',
          }),
        ]),
      );
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
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
