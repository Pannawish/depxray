import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execa } from 'execa';

const CLI_PATH = path.resolve(__dirname, '../dist/index.js');
const FIXTURES_DIR = path.resolve(__dirname, '../../core/__tests__/fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const CIRCULAR_PROJECT = path.join(FIXTURES_DIR, 'circular-project');

describe('CLI Integration Tests', () => {
  beforeEach(async () => {
    // Ensure the output file doesn't exist before each test
    try {
      await fs.rm(path.join(__dirname, 'test-output.json'), { force: true });
    } catch {}
    try {
      await fs.rm(path.join(SIMPLE_PROJECT, '.depxray'), {
        recursive: true,
        force: true,
      });
    } catch {}
  });

  afterEach(async () => {
    try {
      await fs.rm(path.join(__dirname, 'test-output.json'), { force: true });
    } catch {}
    try {
      await fs.rm(path.join(SIMPLE_PROJECT, '.depxray'), {
        recursive: true,
        force: true,
      });
    } catch {}
  });

  describe('scan command', () => {
    it('should bundle the CLI without a runtime @depxray/core dependency', async () => {
      const builtEntry = await fs.readFile(CLI_PATH, 'utf-8');
      expect(builtEntry).not.toContain('require("@depxray/core")');
      expect(builtEntry).not.toContain("require('@depxray/core')");
    });

    it('should output structure JSON with --json', async () => {
      const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--json']);
      
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.mode).toBe('structure');
      expect(parsed.projectRoot).toBe(SIMPLE_PROJECT);
      expect(parsed.totalFiles).toBe(8);
      expect(parsed.totalDirs).toBe(5);
      expect(parsed.totalImports).toBe(0);
      expect(parsed.nodes.some((node: any) => node.relativePath === 'src')).toBe(true);
      expect(stderr).toContain(`Scanning ${SIMPLE_PROJECT}...`);
    });

    it('should write JSON to file when --json --output is passed', async () => {
      const outputPath = path.join(__dirname, 'test-output.json');
      const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--json', '--output', outputPath]);
      
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('');
      expect(stderr).toContain(`Output written to ${outputPath}`);
      
      const fileContent = await fs.readFile(outputPath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.totalFiles).toBe(8);
      expect(parsed.nodes.length).toBeGreaterThan(0);
    });

    it('should generate a static HTML export with --html', async () => {
      const { stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--html', '--depth', '3']);
      
      expect(exitCode).toBe(0);
      const outputDir = path.join(SIMPLE_PROJECT, '.depxray');
      const indexPath = path.join(outputDir, 'index.html');
      const graphDataPath = path.join(outputDir, 'graph-data.json');
      const indexHtml = await fs.readFile(indexPath, 'utf-8');
      const graphData = JSON.parse(await fs.readFile(graphDataPath, 'utf-8'));
      
      expect(stderr).toContain(`Static export written to ${indexPath}`);
      expect(indexHtml).toContain('window.__GRAPH_DATA_SET__ =');
      expect(indexHtml).toContain('window.__DEPXRAY_INITIAL_DEPTH__ = "3"');
      expect(indexHtml).toContain('window.__DEPXRAY_INITIAL_MODE__ = "structure"');
      expect(graphData.defaultMode).toBe('structure');
      expect(graphData.availableModes).toEqual(['structure', 'dependencies']);
      expect(graphData.graphs.structure.totalFiles).toBe(8);
      expect(graphData.graphs.dependencies.totalImports).toBeGreaterThanOrEqual(8);
    });

    it('should respect --ignore flag for structure JSON', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--json', '--ignore', 'pages']);
      
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.nodes.some((node: any) => node.relativePath.includes('pages'))).toBe(false);
      expect(parsed.totalFiles).toBe(7);
    });

    it('should output dependency JSON in dependency mode', async () => {
      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        SIMPLE_PROJECT,
        '--mode',
        'dependencies',
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.mode).toBe('dependencies');
      expect(parsed.totalFiles).toBe(7);
      expect(parsed.totalImports).toBeGreaterThanOrEqual(8);
      expect(parsed.totalDirs).toBe(0);
      expect(parsed.orphanFiles).toEqual([]);
      expect(parsed.nodes.some((node: any) => node.outDegree >= 1)).toBe(true);
    });

    it('should include and print orphan files in dependency mode', async () => {
      const { stdout, stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        CIRCULAR_PROJECT,
        '--mode',
        'dependencies',
        '--json',
        '--orphans',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.orphanFiles).toContain('src/standalone.ts');
      expect(parsed.nodes.some((node: any) => (
        node.relativePath === 'src/standalone.ts' && node.isOrphan
      ))).toBe(true);
      expect(stderr).toContain('Orphan files');
      expect(stderr).toContain('src/standalone.ts');
    });

    it('should include circular dependency metadata in dependency mode', async () => {
      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        CIRCULAR_PROJECT,
        '--mode',
        'dependencies',
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.mode).toBe('dependencies');
      expect(parsed.circularCount).toBeGreaterThanOrEqual(2);
      expect(parsed.nodes.some((node: any) => node.isCircular)).toBe(true);
    });

    it('should generate dependency-mode static HTML export', async () => {
      const { exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        SIMPLE_PROJECT,
        '--mode',
        'dependencies',
        '--html',
      ]);

      expect(exitCode).toBe(0);
      const outputDir = path.join(SIMPLE_PROJECT, '.depxray');
      const graphData = JSON.parse(
        await fs.readFile(path.join(outputDir, 'graph-data.json'), 'utf-8'),
      );
      expect(graphData.defaultMode).toBe('dependencies');
      expect(graphData.graphs.dependencies.totalImports).toBeGreaterThanOrEqual(8);
      expect(graphData.graphs.structure.totalFiles).toBe(8);
    });

  });

  describe('inspect command', () => {
    it('should inspect a file and output text', async () => {
      const fileToInspect = 'src/App.tsx';
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'inspect', fileToInspect, '--dir', SIMPLE_PROJECT]);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain(fileToInspect);
      expect(stdout).toContain('This file imports:');
      expect(stdout).toContain('→ src/components/Header.tsx');
    });

    it('should inspect a file and output JSON', async () => {
      const fileToInspect = 'src/App.tsx';
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'inspect', fileToInspect, '--dir', SIMPLE_PROJECT, '--format', 'json']);
      
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.file).toBe(fileToInspect);
      expect(parsed.imports.length).toBeGreaterThan(0);
      expect(parsed.imports.some((i: any) => i.file === 'src/components/Header.tsx')).toBe(true);
    });

    it('should fail cleanly if file is not found', async () => {
      try {
        await execa('node', [CLI_PATH, 'inspect', 'src/NonExistent.tsx', '--dir', SIMPLE_PROJECT]);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('File not found:');
      }
    });
  });

  describe('error cases and help', () => {
    it('should fail if directory does not exist', async () => {
      try {
        await execa('node', [CLI_PATH, 'scan', '/invalid/directory/path', '--json']);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('Directory not found');
      }
    });

    it('should show help output', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, '--help']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage: depxray');
      expect(stdout).toContain('scan [options]');
      expect(stdout).toContain('inspect [options]');
      expect(stdout).not.toContain('legacy');
    });

    it('should document the accepted depth values in scan help', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'scan', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('integer >= 1 or all');
    });

    it('should accept depth values greater than 4', async () => {
      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        SIMPLE_PROJECT,
        '--json',
        '--depth',
        '5',
      ]);

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout).mode).toBe('structure');
    });
  });
});
