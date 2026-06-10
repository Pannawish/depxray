import { describe, it, expect } from 'vitest';
import packageJson from '../package.json';
import * as path from 'path';
import { scanProject } from '../src/scanProject.js';
import { exportGraphJSON } from '../src/exportGraph.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const CIRCULAR_PROJECT = path.join(FIXTURES_DIR, 'circular-project');

describe('scanProject — integration', () => {
  // ─── Simple project ──────────────────────────────────────────────────

  it('should scan simple-project and return a valid ScanResult', async () => {
    const result = await scanProject({ rootDir: SIMPLE_PROJECT });

    expect(result.totalFiles).toBeGreaterThan(0);
    expect(result.graph.nodes.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect all files in simple-project', async () => {
    const result = await scanProject({ rootDir: SIMPLE_PROJECT });

    // App.tsx, types.ts, Header.tsx, Footer.tsx, index.ts, helpers.ts, Dashboard.tsx
    expect(result.totalFiles).toBe(7);
  });

  it('should detect import edges in simple-project', async () => {
    const result = await scanProject({ rootDir: SIMPLE_PROJECT });

    // At minimum: App→Header, App→Footer, App→helpers(@utils/helpers),
    // App→types, App→Dashboard(dynamic), Header→types, Header→helpers,
    // Footer→types, index→Header, index→Footer
    expect(result.totalImports).toBeGreaterThanOrEqual(8);
  });

  it('should resolve tsconfig path aliases', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      resolveAliases: true,
    });

    // The @utils/helpers import from App.tsx should be resolved
    const appNode = result.graph.nodes.find((n) =>
      n.relativePath.endsWith('App.tsx'),
    )!;
    expect(appNode).toBeDefined();
    expect(appNode.outDegree).toBeGreaterThanOrEqual(3);

    // Check that helpers.ts has inbound edges (from App and Header)
    const helpersNode = result.graph.nodes.find((n) =>
      n.relativePath.endsWith('helpers.ts'),
    )!;
    expect(helpersNode).toBeDefined();
    expect(helpersNode.inDegree).toBeGreaterThanOrEqual(1);
  });

  it('should detect dynamic imports', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      includeDynamicImports: true,
    });

    // App.tsx has a dynamic import of Dashboard
    const dynamicEdge = result.graph.edges.find(
      (e) => e.isDynamic && e.target.includes('Dashboard'),
    );
    expect(dynamicEdge).toBeDefined();
  });

  it('should detect type-only imports', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      includeTypeImports: true,
    });

    // App.tsx has `import type { AppProps }` from ./types
    const typeEdges = result.graph.edges.filter((e) => e.isTypeOnly);
    expect(typeEdges.length).toBeGreaterThan(0);
  });

  it('should not detect circular dependencies in simple-project', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      detectCircular: true,
    });

    expect(result.circularCount).toBe(0);
    expect(result.graph.circularDependencies).toHaveLength(0);
  });

  it('should expose orphan files while excluding default entry points', async () => {
    const simpleResult = await scanProject({ rootDir: SIMPLE_PROJECT });
    expect(simpleResult.orphanFiles).toEqual([]);

    const circularResult = await scanProject({ rootDir: CIRCULAR_PROJECT });
    expect(circularResult.orphanFiles).toContain('src/standalone.ts');
  });

  it('should respect custom orphan entry point patterns', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      entryPointPatterns: [],
    });

    expect(result.orphanFiles).toEqual([
      'src/App.tsx',
      'src/components/index.ts',
    ]);
  });

  // ─── Circular project ────────────────────────────────────────────────

  it('should detect circular dependencies in circular-project', async () => {
    const result = await scanProject({
      rootDir: CIRCULAR_PROJECT,
      detectCircular: true,
    });

    // Should detect A↔B cycle and C→D→E→C cycle
    expect(result.circularCount).toBeGreaterThanOrEqual(2);
    expect(result.graph.circularDependencies.length).toBeGreaterThanOrEqual(2);
  });

  it('should mark circular nodes in circular-project', async () => {
    const result = await scanProject({
      rootDir: CIRCULAR_PROJECT,
      detectCircular: true,
    });

    const circularNodes = result.graph.nodes.filter((n) => n.isCircular);
    // A, B, C, D, E should all be circular (5 nodes)
    expect(circularNodes.length).toBeGreaterThanOrEqual(4);

    // standalone.ts should NOT be circular
    const standaloneNode = result.graph.nodes.find((n) =>
      n.relativePath.includes('standalone'),
    );
    expect(standaloneNode).toBeDefined();
    expect(standaloneNode!.isCircular).toBe(false);
  });

  // ─── Options ─────────────────────────────────────────────────────────

  it('should respect detectCircular: false', async () => {
    const result = await scanProject({
      rootDir: CIRCULAR_PROJECT,
      detectCircular: false,
    });

    // Even though there are cycles, detection was disabled
    expect(result.circularCount).toBe(0);
    expect(result.graph.circularDependencies).toHaveLength(0);
  });

  it('should respect custom extensions filter', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      extensions: ['.ts'], // Only .ts, no .tsx
    });

    // Should find: types.ts, index.ts, helpers.ts
    expect(result.totalFiles).toBe(3);
    for (const node of result.graph.nodes) {
      expect(node.extension).toBe('.ts');
    }
  });

  it('should respect custom ignore patterns', async () => {
    const result = await scanProject({
      rootDir: SIMPLE_PROJECT,
      ignorePatterns: ['pages'], // Ignore the pages directory
    });

    // Dashboard.tsx may still appear as a node (because App.tsx imports it),
    // but it should NOT have been scanned for its own imports (outDegree = 0).
    const dashboardNode = result.graph.nodes.find((n) =>
      n.relativePath.includes('Dashboard'),
    );
    if (dashboardNode) {
      expect(dashboardNode.outDegree).toBe(0);
    }

    // The ignored directory's files should not be in the scan count
    // (totalFiles counts scanned files, not import targets)
    const scannedCount = result.graph.nodes.filter(
      (n) => !n.relativePath.includes('pages'),
    ).length;
    expect(scannedCount).toBe(6); // 7 total minus Dashboard
  });

  it('should attach metrics to scanned file nodes', async () => {
    const result = await scanProject({ rootDir: SIMPLE_PROJECT });
    const appNode = result.graph.nodes.find((node) => node.relativePath === 'src/App.tsx');

    expect(appNode?.metrics).toBeDefined();
    expect(appNode!.metrics!.loc).toBeGreaterThan(0);
    expect(appNode!.metrics!.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
    expect(appNode!.metrics!.exportCount).toBeGreaterThanOrEqual(1);
    expect(appNode!.metrics!.instability).toBe(
      appNode!.outDegree / (appNode!.inDegree + appNode!.outDegree),
    );
  });

  // ─── Export ──────────────────────────────────────────────────────────

  it('should produce valid exportable JSON', async () => {
    const result = await scanProject({ rootDir: SIMPLE_PROJECT });
    const json = exportGraphJSON(result.graph);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe('1.0.0');
    expect(parsed.nodes.length).toBe(result.totalFiles);
    expect(parsed.edges.length).toBe(result.totalImports);
    expect(parsed.metadata.depxrayVersion).toBe(packageJson.version);
    expect(parsed.nodes.some((node: any) => node.metrics?.loc > 0)).toBe(true);
  });

  // ─── Error handling ──────────────────────────────────────────────────

  it('should throw for non-existent directory', async () => {
    await expect(
      scanProject({ rootDir: '/nonexistent/path/that/does/not/exist' }),
    ).rejects.toThrow();
  });

  it('should return empty result for directory with no scannable files', async () => {
    // Use a directory that exists but has no .ts/.tsx files
    const result = await scanProject({
      rootDir: FIXTURES_DIR,
      maxDepth: 0, // Don't recurse — fixtures dir has no direct .ts files
    });

    expect(result.totalFiles).toBe(0);
    expect(result.graph.nodes).toHaveLength(0);
    expect(result.graph.edges).toHaveLength(0);
  });

  // ─── Metadata ────────────────────────────────────────────────────────

  it('should include scan metadata', async () => {
    const result = await scanProject({ rootDir: SIMPLE_PROJECT });

    expect(result.graph.metadata.scannedAt).toBeTruthy();
    expect(result.graph.metadata.scanDurationMs).toBeGreaterThan(0);
    expect(result.graph.metadata.projectRoot).toBe(
      path.resolve(SIMPLE_PROJECT),
    );
    expect(result.graph.metadata.depxrayVersion).toBe(packageJson.version);
  });
});
