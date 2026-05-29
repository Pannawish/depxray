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
  });

  afterEach(async () => {
    try {
      await fs.rm(path.join(__dirname, 'test-output.json'), { force: true });
    } catch {}
  });

  describe('scan command', () => {
    it('should output JSON by default', async () => {
      const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT]);
      
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.metadata.projectRoot).toBe(SIMPLE_PROJECT);
      expect(parsed.nodes.length).toBe(7);
    });

    it('should output text format when --format text is passed', async () => {
      const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--format', 'text']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('React Dependency Graph — Scan Results');
      expect(stdout).toContain('Files:       7');
      expect(stderr).toContain(`Scanning ${SIMPLE_PROJECT}...`); // Scanner writes progress to stderr
    });

    it('should output DOT format when --format dot is passed', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--format', 'dot']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('digraph DependencyGraph {');
      expect(stdout).toContain('src/App.tsx');
      expect(stdout).toContain('->'); // Edge indicator
    });

    it('should write output to file when --output flag is used', async () => {
      const outputPath = path.join(__dirname, 'test-output.json');
      const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--output', outputPath]);
      
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe(''); // Output goes to file
      expect(stderr).toContain(`Output written to ${outputPath}`);
      
      const fileContent = await fs.readFile(outputPath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.nodes.length).toBe(7);
    });

    it('should respect --ignore flag', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'scan', SIMPLE_PROJECT, '--ignore', 'pages']);
      
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      const hasPages = parsed.nodes.some((n: any) => n.relativePath.includes('pages'));
      // Note: We use the logic from core tests: outDegree should be 0 since it wasn't scanned
      const dashboardNode = parsed.nodes.find((n: any) => n.relativePath.includes('Dashboard'));
      if (dashboardNode) {
        expect(dashboardNode.outDegree).toBe(0);
      }
      
      const scannedCount = parsed.nodes.filter((n: any) => !n.relativePath.includes('pages')).length;
      expect(scannedCount).toBe(6);
    });

    it('should respect --no-circular flag', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, 'scan', CIRCULAR_PROJECT, '--no-circular']);
      
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.circularDependencies).toHaveLength(0);
      expect(parsed.metadata.circularCount).toBe(0);
    });
    
    it('should warn about circular dependencies in stderr when found', async () => {
      const { stderr, exitCode } = await execa('node', [CLI_PATH, 'scan', CIRCULAR_PROJECT, '--format', 'text']);
      
      expect(exitCode).toBe(0); // Assuming warning doesn't fail the command natively unless we changed it to
      expect(stderr).toContain('Found 2 circular dependency chain(s)');
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
        await execa('node', [CLI_PATH, 'scan', '/invalid/directory/path']);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('Directory not found');
      }
    });

    it('should show help output', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, '--help']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage: react-dependency-graph');
      expect(stdout).toContain('scan [options]');
      expect(stdout).toContain('inspect [options]');
    });
  });
});
