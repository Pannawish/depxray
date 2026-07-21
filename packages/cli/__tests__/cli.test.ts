import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execa } from 'execa';

const CLI_PATH = path.resolve(__dirname, '../dist/index.js');
const FIXTURES_DIR = path.resolve(__dirname, '../../core/__tests__/fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const CIRCULAR_PROJECT = path.join(FIXTURES_DIR, 'circular-project');
const TEMP_DIR = path.join(__dirname, 'tmp-cli-tests');

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
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
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
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
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
      expect(parsed.nodes.some((node: any) => node.metrics?.loc > 0)).toBe(true);
    });

    it('should output Mermaid dependency graph format', async () => {
      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        SIMPLE_PROJECT,
        '--mode',
        'dependencies',
        '--json',
        '--format',
        'mermaid',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('flowchart LR');
      expect(stdout).toContain('src/App.tsx');
      expect(stdout).toContain('-->');
    });

    it('should output DOT dependency graph format', async () => {
      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        SIMPLE_PROJECT,
        '--mode',
        'dependencies',
        '--json',
        '--format',
        'dot',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('digraph DependencyGraph');
      expect(stdout).toContain('rankdir=LR');
      expect(stdout).toContain('->');
    });

    it('should output SARIF dependency findings', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        "import './missing';\nexport const value = 1;\n",
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--mode',
        'dependencies',
        '--json',
        '--format',
        'sarif',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.version).toBe('2.1.0');
      expect(parsed.runs[0].results.some((result: any) => (
        result.ruleId === 'depxray/unresolved-import'
      ))).toBe(true);
    });

    it('should write Mermaid output to file', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      const outputPath = path.join(TEMP_DIR, 'graph.mmd');

      const { stdout, stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        SIMPLE_PROJECT,
        '--mode',
        'dependencies',
        '--json',
        '--format',
        'mermaid',
        '--output',
        outputPath,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('');
      expect(stderr).toContain(`Output written to ${outputPath}`);
      expect(await fs.readFile(outputPath, 'utf-8')).toContain('flowchart LR');
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

    it('should surface unused exports and unresolved imports in dependency JSON and stderr', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        [
          "import { usedValue } from './feature';",
          "import './missing-module';",
          'export const value = usedValue;',
        ].join('\n'),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/feature.ts'),
        [
          'export const usedValue = "used";',
          'export const unusedValue = "unused";',
        ].join('\n'),
        'utf-8',
      );

      const { stdout, stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--mode',
        'dependencies',
        '--json',
        '--unused-exports',
        '--unresolved',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.unresolvedImports).toHaveLength(1);
      expect(parsed.unresolvedImports[0].importSpecifier).toBe('./missing-module');
      expect(parsed.nodes.some((node: any) => (
        node.relativePath === 'src/feature.ts'
        && node.unusedExports?.some((issue: any) => issue.name === 'unusedValue')
      ))).toBe(true);
      expect(stderr).toContain('Unused exports');
      expect(stderr).toContain('unusedValue');
      expect(stderr).toContain('Unresolved imports');
      expect(stderr).toContain('./missing-module');
    });

    it('should show autofix dry-run actions without modifying files', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      const featurePath = path.join(TEMP_DIR, 'src/feature.ts');
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        "import { usedValue } from './feature';\nexport const value = usedValue;\n",
        'utf-8',
      );
      await fs.writeFile(
        featurePath,
        'export const usedValue = "used";\nexport const unusedValue = "unused";\n',
        'utf-8',
      );

      const { stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--fix',
        '--dry-run',
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toContain('Planned actions');
      expect(stderr).toContain('unusedValue');
      expect(await fs.readFile(featurePath, 'utf-8')).toContain('unusedValue');
    });

    it('should include unused and unlisted npm dependencies with --deps', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
            lodash: '^4.17.21',
          },
          devDependencies: {
            vitest: '^1.0.0',
          },
        }),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        [
          "import React from 'react';",
          "import '@scope/unlisted/subpath';",
          "import path from 'node:path';",
          'export const value = React.createElement("div", { id: path.sep });',
        ].join('\n'),
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--mode',
        'dependencies',
        '--deps',
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.dependencyIssues).toEqual({
        unused: ['lodash', 'vitest'],
        unlisted: ['@scope/unlisted'],
      });
    });

    it('should remove unused npm dependencies when --fix is combined with --deps', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      const packagePath = path.join(TEMP_DIR, 'package.json');
      await fs.writeFile(
        packagePath,
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
            lodash: '^4.17.21',
          },
          devDependencies: {
            vitest: '^1.0.0',
          },
        }, null, 2),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        [
          "import React from 'react';",
          'export const value = React.createElement("div");',
        ].join('\n'),
        'utf-8',
      );

      const dryRun = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--fix',
        '--deps',
        '--dry-run',
      ]);
      expect(dryRun.stderr).toContain('remove unused dependency: lodash');
      expect(dryRun.stderr).toContain('remove unused dependency: vitest');
      expect(await fs.readFile(packagePath, 'utf-8')).toContain('lodash');

      const applied = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--fix',
        '--deps',
        '--yes',
      ]);
      expect(applied.stderr).toContain('Autofix applied');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      expect(packageJson.dependencies).toEqual({ react: '^18.0.0' });
      expect(packageJson.devDependencies).toBeUndefined();
    });

    it('should include workspace and cross-package metadata in dependency JSON', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'packages/app/src'), { recursive: true });
      await fs.mkdir(path.join(TEMP_DIR, 'packages/lib/src'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'package.json'),
        JSON.stringify({ private: true, workspaces: ['packages/*'] }),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'packages/app/package.json'),
        JSON.stringify({ name: '@repo/app' }),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'packages/lib/package.json'),
        JSON.stringify({ name: '@repo/lib' }),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'packages/lib/src/index.ts'),
        'export function util() { return "ok"; }\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'packages/app/src/index.ts'),
        'import { util } from "@repo/lib";\nexport const value = util();\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--mode',
        'dependencies',
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.nodes.some((node: any) => (
        node.relativePath === 'packages/app/src/index.ts' && node.workspace === '@repo/app'
      ))).toBe(true);
      expect(parsed.nodes.some((node: any) => (
        node.relativePath === 'packages/lib/src/index.ts' && node.workspace === '@repo/lib'
      ))).toBe(true);
      expect(parsed.edges.some((edge: any) => edge.isCrossPackage)).toBe(true);
    });

    it('should reject --deps with structure JSON output', async () => {
      try {
        await execa('node', [
          CLI_PATH,
          'scan',
          SIMPLE_PROJECT,
          '--deps',
          '--json',
        ]);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('--deps is only supported with --mode dependencies');
      }
    });

    it('should reject graph export formats outside dependency JSON output', async () => {
      try {
        await execa('node', [
          CLI_PATH,
          'scan',
          SIMPLE_PROJECT,
          '--json',
          '--format',
          'mermaid',
        ]);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('--format mermaid|dot|sarif is only supported with --mode dependencies');
      }
    });

    it('should validate architecture rules and exit non-zero for errors', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src/ui'), { recursive: true });
      await fs.mkdir(path.join(TEMP_DIR, 'src/db'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'depxray.config.js'),
        'module.exports = { rules: [{ from: "src/ui/**", to: "src/db/**", severity: "error", message: "UI cannot import DB" }] };\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/db/client.ts'),
        'export const client = {};\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/ui/Button.ts'),
        'import { client } from "../db/client";\nexport const button = client;\n',
        'utf-8',
      );

      try {
        await execa('node', [
          CLI_PATH,
          'scan',
          TEMP_DIR,
          '--mode',
          'dependencies',
          '--json',
          '--validate',
        ]);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('Architecture rule violations: 1 error(s), 0 warning(s)');
        expect(err.stderr).toContain('UI cannot import DB');
        const parsed = JSON.parse(err.stdout);
        expect(parsed.ruleValidation.errorCount).toBe(1);
        expect(parsed.edges.some((edge: any) => edge.ruleViolations?.length === 1)).toBe(true);
      }
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

    it('should read depxray config when scan flags are not passed', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      await fs.cp(SIMPLE_PROJECT, path.join(TEMP_DIR, 'project'), { recursive: true });
      const projectDir = path.join(TEMP_DIR, 'project');
      await fs.writeFile(
        path.join(projectDir, 'depxray.config.js'),
        'module.exports = { mode: "dependencies", extensions: [".ts"], entryPoints: [] };\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        projectDir,
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.mode).toBe('dependencies');
      expect(parsed.totalFiles).toBe(3);
    });

    it('should run built-in plugins from depxray config', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      await fs.cp(SIMPLE_PROJECT, path.join(TEMP_DIR, 'project'), { recursive: true });
      const projectDir = path.join(TEMP_DIR, 'project');
      await fs.writeFile(
        path.join(projectDir, 'depxray.config.js'),
        'module.exports = { mode: "dependencies", plugins: ["@depxray/plugin-complexity", "@depxray/plugin-mcp"] };\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        projectDir,
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.pluginData.complexity.totalLoc).toBeGreaterThan(0);
      expect(parsed.pluginData.mcp.tools).toContain('scan_project');
    });

    it('should run local module plugins from depxray config', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'depxray-plugin.mjs'),
        [
          'export function afterBuildGraph(graph) {',
          '  return {',
          '    ...graph,',
          '    nodes: graph.nodes.map((node) => ({ ...node, pluginData: { customNode: node.relativePath } })),',
          '  };',
          '}',
          'export function afterScan(result) {',
          '  return { ...result, pluginData: { ...result.pluginData, custom: { files: result.totalFiles } } };',
          '}',
        ].join('\n'),
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'depxray.config.js'),
        'module.exports = { mode: "dependencies", plugins: ["./depxray-plugin.mjs"] };\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        'export const value = 1;\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        TEMP_DIR,
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.pluginData.custom.files).toBeGreaterThanOrEqual(1);
      expect(parsed.nodes.some((node: any) => (
        node.relativePath === 'src/index.ts' &&
        node.pluginData.customNode === 'src/index.ts'
      ))).toBe(true);
    });

    it('should let CLI flags override depxray config', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      await fs.cp(SIMPLE_PROJECT, path.join(TEMP_DIR, 'project'), { recursive: true });
      const projectDir = path.join(TEMP_DIR, 'project');
      await fs.writeFile(
        path.join(projectDir, 'depxray.config.js'),
        'module.exports = { mode: "dependencies" };\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'scan',
        projectDir,
        '--mode',
        'structure',
        '--json',
      ]);

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout).mode).toBe('structure');
    });

  });

  describe('init command', () => {
    it('should create a default depxray.config.js', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });

      const { stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'init',
        TEMP_DIR,
        '--defaults',
      ]);

      expect(exitCode).toBe(0);
      const configPath = path.join(TEMP_DIR, 'depxray.config.js');
      const config = await fs.readFile(configPath, 'utf-8');
      expect(stderr).toContain(`Created ${configPath}`);
      expect(config).toContain('mode:');
      expect(config).toContain('extensions:');
      expect(config).toContain('entryPoints:');
    });

    it('should not overwrite an existing config without --force', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      await fs.writeFile(path.join(TEMP_DIR, 'depxray.config.js'), 'module.exports = {};\n', 'utf-8');

      try {
        await execa('node', [CLI_PATH, 'init', TEMP_DIR, '--defaults']);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('Config already exists');
      }
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

  describe('report command', () => {
    it('should output a Markdown health report', async () => {
      const { stdout, stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'report',
        SIMPLE_PROJECT,
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toContain(`Generating report for ${SIMPLE_PROJECT}`);
      expect(stdout).toContain('# depxray Project Health Report');
      expect(stdout).toContain('## Summary');
      expect(stdout).toContain('| Files | 7 |');
      expect(stdout).toContain('| Imports |');
      expect(stdout).toContain('## Top 10 Most Imported Files');
      expect(stdout).toContain('## Top 10 Most Importing Files');
      expect(stdout).toContain('## Complexity Hotspots');
      expect(stdout).toContain('`src/components/Header.tsx`');
    });

    it('should write a Markdown health report to a file', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      const outputPath = path.join(TEMP_DIR, 'report.md');
      const { stdout, stderr, exitCode } = await execa('node', [
        CLI_PATH,
        'report',
        CIRCULAR_PROJECT,
        '--output',
        outputPath,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('');
      expect(stderr).toContain(`Report written to ${outputPath}`);

      const report = await fs.readFile(outputPath, 'utf-8');
      expect(report).toContain('# depxray Project Health Report');
      expect(report).toContain('## Orphan Files');
      expect(report).toContain('`src/standalone.ts`');
      expect(report).toContain('## Circular Dependency Chains');
    });

    it('should run report hooks from depxray config', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      await fs.cp(SIMPLE_PROJECT, path.join(TEMP_DIR, 'project'), { recursive: true });
      const projectDir = path.join(TEMP_DIR, 'project');
      await fs.writeFile(
        path.join(projectDir, 'depxray-report-plugin.mjs'),
        [
          'export function onReport(data) {',
          '  data.sections.push("## Plugin Section\\n\\nGenerated by plugin.");',
          '  return data;',
          '}',
        ].join('\n'),
        'utf-8',
      );
      await fs.writeFile(
        path.join(projectDir, 'depxray.config.js'),
        'module.exports = { plugins: ["./depxray-report-plugin.mjs"] };\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'report',
        projectDir,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('## Plugin Section');
      expect(stdout).toContain('Generated by plugin.');
    });

    it('should show report help from the root help output', async () => {
      const { stdout, exitCode } = await execa('node', [CLI_PATH, '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('report [options]');
    });
  });

  describe('diff command', () => {
    it('should output JSON diff for two graph snapshots', async () => {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      const beforePath = path.join(TEMP_DIR, 'before.json');
      const afterPath = path.join(TEMP_DIR, 'after.json');
      await fs.writeFile(
        beforePath,
        JSON.stringify({
          projectRoot: '/project',
          nodes: [{ relativePath: 'src/App.ts' }],
          edges: [],
          circularDependencies: [],
        }),
        'utf-8',
      );
      await fs.writeFile(
        afterPath,
        JSON.stringify({
          projectRoot: '/project',
          nodes: [
            { relativePath: 'src/App.ts' },
            { relativePath: 'src/New.ts' },
          ],
          edges: [
            {
              source: '/project/src/App.ts',
              target: '/project/src/New.ts',
              importSpecifier: './New',
            },
          ],
          circularDependencies: [],
        }),
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'diff',
        beforePath,
        afterPath,
        '--json',
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.addedFiles).toEqual(['src/New.ts']);
      expect(parsed.addedEdges).toEqual([
        {
          source: 'src/App.ts',
          target: 'src/New.ts',
          importSpecifier: './New',
        },
      ]);
    });

    it('should compare the working tree against a git base ref', async () => {
      const repoDir = path.join(TEMP_DIR, 'repo');
      await fs.mkdir(path.join(repoDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(repoDir, 'package.json'), '{}\n', 'utf-8');
      await fs.writeFile(
        path.join(repoDir, 'src/index.ts'),
        'export const value = 1;\n',
        'utf-8',
      );
      await execa('git', ['init'], { cwd: repoDir });
      await execa('git', ['add', '.'], { cwd: repoDir });
      await execa('git', [
        '-c',
        'user.name=depxray',
        '-c',
        'user.email=depxray@example.com',
        'commit',
        '-m',
        'initial',
      ], { cwd: repoDir });
      await fs.writeFile(
        path.join(repoDir, 'src/new.ts'),
        'export const next = 2;\n',
        'utf-8',
      );

      const { stdout, exitCode } = await execa('node', [
        CLI_PATH,
        'diff',
        '--base',
        'HEAD',
        '--dir',
        repoDir,
        '--json',
      ]);

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout).addedFiles).toContain('src/new.ts');
    });
  });

  describe('entry analysis and check commands', () => {
    it('should list entry points, print trees, trace dependents, and fail check on findings', async () => {
      await fs.mkdir(path.join(TEMP_DIR, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/index.ts'),
        "import { helper } from './helper';\nexport const value = helper;\n",
        'utf-8',
      );
      await fs.writeFile(
        path.join(TEMP_DIR, 'src/helper.ts'),
        "import './missing';\nexport const helper = 'ok';\n",
        'utf-8',
      );

      const entryPoints = await execa('node', [
        CLI_PATH,
        'entry-points',
        TEMP_DIR,
        '--json',
      ]);
      expect(JSON.parse(entryPoints.stdout).entryPoints.map((item: any) => item.file)).toContain('src/index.ts');

      const tree = await execa('node', [
        CLI_PATH,
        'tree',
        'src/index.ts',
        TEMP_DIR,
        '--json',
      ]);
      expect(JSON.parse(tree.stdout).imports[0].file).toBe('src/helper.ts');

      const trace = await execa('node', [
        CLI_PATH,
        'trace',
        'src/helper.ts',
        TEMP_DIR,
        '--json',
      ]);
      expect(JSON.parse(trace.stdout).entryPoints).toEqual(['src/index.ts']);

      const impact = await execa('node', [
        CLI_PATH,
        'impact',
        'src/helper.ts',
        TEMP_DIR,
        '--json',
      ]);
      const impactJson = JSON.parse(impact.stdout);
      expect(impactJson.target.file).toBe('src/helper.ts');
      expect(impactJson.affectedFiles.map((item: any) => item.file)).toEqual(['src/index.ts']);
      expect(impactJson.directDependentCount).toBe(1);

      try {
        await execa('node', [
          CLI_PATH,
          'check',
          TEMP_DIR,
          '--json',
        ]);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(JSON.parse(err.stdout).summary.unresolvedImports).toBe(1);
      }
    });

    it('should fail only for findings introduced after a Git baseline', async () => {
      const repoDir = path.join(TEMP_DIR, 'baseline-repo');
      await fs.mkdir(path.join(repoDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(repoDir, 'src/index.ts'),
        "import './existing-missing';\nexport const value = 1;\n",
        'utf-8',
      );
      await execa('git', ['init'], { cwd: repoDir });
      await execa('git', ['add', '.'], { cwd: repoDir });
      await execa('git', [
        '-c', 'user.name=depxray-test',
        '-c', 'user.email=depxray@example.com',
        'commit',
        '-m',
        'baseline',
      ], { cwd: repoDir });

      const inherited = await execa('node', [
        CLI_PATH,
        'check',
        repoDir,
        '--base',
        'HEAD',
        '--json',
      ]);
      expect(inherited.exitCode).toBe(0);
      expect(JSON.parse(inherited.stdout).baseline.newIssueCount).toBe(0);

      await fs.appendFile(path.join(repoDir, 'src/index.ts'), "import './new-missing';\n");
      try {
        await execa('node', [
          CLI_PATH,
          'check',
          repoDir,
          '--base',
          'HEAD',
          '--json',
        ]);
        expect.fail('Should have failed for the newly introduced import.');
      } catch (error: any) {
        expect(error.exitCode).toBe(1);
        const output = JSON.parse(error.stdout);
        expect(output.baseline.newIssueCount).toBe(1);
        expect(output.baseline.newIssues.unresolvedImports).toHaveLength(1);
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
      expect(stdout).toContain('--watch');
    });

    it('should reject watch mode with JSON output', async () => {
      try {
        await execa('node', [
          CLI_PATH,
          'scan',
          SIMPLE_PROJECT,
          '--json',
          '--watch',
        ]);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('--watch is only supported with the local browser UI');
      }
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
