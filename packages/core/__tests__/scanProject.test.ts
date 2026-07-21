import { describe, it, expect } from 'vitest';
import packageJson from '../package.json';
import * as path from 'path';
import * as fs from 'fs/promises';
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
    const appNode = result.graph.nodes.find((n) => n.relativePath.endsWith('App.tsx'))!;
    expect(appNode).toBeDefined();
    expect(appNode.outDegree).toBeGreaterThanOrEqual(3);

    // Check that helpers.ts has inbound edges (from App and Header)
    const helpersNode = result.graph.nodes.find((n) => n.relativePath.endsWith('helpers.ts'))!;
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

    expect(result.orphanFiles).toEqual(['src/App.tsx', 'src/components/index.ts']);
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
    const standaloneNode = result.graph.nodes.find((n) => n.relativePath.includes('standalone'));
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
    const dashboardNode = result.graph.nodes.find((n) => n.relativePath.includes('Dashboard'));
    if (dashboardNode) {
      expect(dashboardNode.outDegree).toBe(0);
    }

    // The ignored directory's files should not be in the scan count
    // (totalFiles counts scanned files, not import targets)
    const scannedCount = result.graph.nodes.filter((n) => !n.relativePath.includes('pages')).length;
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

  it('should detect unused exports across barrels and export-all re-exports', async () => {
    const projectDir = path.join(__dirname, 'tmp-unused-exports-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'src/index.ts'),
      [
        "import { usedValue, starUsed } from './barrel';",
        'export const entry = [usedValue, starUsed].join(":");',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/barrel.ts'),
      [
        "export { usedValue, unusedValue, type SharedType } from './feature';",
        "export * from './widgets';",
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/feature.ts'),
      [
        'export const usedValue = "used";',
        'export const unusedValue = "unused";',
        'export default function Feature() { return usedValue; }',
        'export type SharedType = { value: string };',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/widgets.ts'),
      ['export const starUsed = "used";', 'export const starUnused = "unused";'].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/public-api.ts'),
      'export const publicValue = "entry-point";\n',
      'utf-8',
    );

    try {
      const result = await scanProject({
        rootDir: projectDir,
        entryPointPatterns: ['src/index.ts', 'src/public-api.ts'],
      });

      const byRelativePath = new Map(result.graph.nodes.map((node) => [node.relativePath, node]));

      expect(byRelativePath.get('src/index.ts')?.unusedExports ?? []).toEqual([]);
      expect(byRelativePath.get('src/public-api.ts')?.unusedExports ?? []).toEqual([]);
      expect(byRelativePath.get('src/barrel.ts')?.unusedExports).toEqual([
        { name: 'SharedType', kind: 'reexport', isTypeOnly: true, line: 1 },
        { name: 'unusedValue', kind: 'reexport', isTypeOnly: false, line: 1 },
      ]);
      expect(byRelativePath.get('src/feature.ts')?.unusedExports).toEqual([
        { name: 'unusedValue', kind: 'named', isTypeOnly: false, line: 2 },
        { name: 'default', kind: 'default', isTypeOnly: false, line: 3 },
        { name: 'SharedType', kind: 'named', isTypeOnly: true, line: 4 },
      ]);
      expect(byRelativePath.get('src/widgets.ts')?.unusedExports).toEqual([
        { name: 'starUnused', kind: 'named', isTypeOnly: false, line: 2 },
      ]);
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  it('should collect unresolved imports while ignoring external packages and assets', async () => {
    const projectDir = path.join(__dirname, 'tmp-unresolved-imports-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'src/index.ts'),
      [
        "import { helper } from './missing-helper';",
        "import './missing.css';",
        "import React from 'react';",
        'export const value = helper;',
      ].join('\n'),
      'utf-8',
    );

    try {
      const result = await scanProject({ rootDir: projectDir });
      const indexNode = result.graph.nodes.find((node) => node.relativePath === 'src/index.ts');

      expect(result.unresolvedImports).toHaveLength(1);
      expect(result.unresolvedImports[0]).toMatchObject({
        file: 'src/index.ts',
        absoluteFilePath: path.join(projectDir, 'src/index.ts'),
        importSpecifier: './missing-helper',
        line: 1,
        isTypeOnly: false,
        isDynamic: false,
      });
      expect(result.unresolvedImports[0]?.error).toContain('Could not resolve');
      expect(indexNode?.unresolvedImports).toEqual(result.unresolvedImports);
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  it('should detect devDependencies imported from production entry point trees', async () => {
    const projectDir = path.join(__dirname, 'tmp-devdeps-prod-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/main.ts'),
      "import { helper } from './helper';\nexport const value = helper;\n",
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/helper.ts'),
      "import { describe } from 'vitest';\nexport const helper = describe;\n",
      'utf-8',
    );

    try {
      const result = await scanProject({
        rootDir: projectDir,
        prodEntryPoints: ['src/main.ts'],
      });

      expect(result.devDepsInProd).toEqual([
        {
          file: 'src/helper.ts',
          module: 'vitest',
          importSpecifier: 'vitest',
          line: 1,
          entryPoint: 'src/main.ts',
          isTypeOnly: false,
        },
      ]);
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  it('should detect import convention violations and scoped restricted imports', async () => {
    const projectDir = path.join(__dirname, 'tmp-conventions-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'src/server.ts'),
      [
        "import React from 'react';",
        "import { helper } from './helper';",
        'export const server = [React, helper];',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'src/helper.ts'),
      'export const helper = "ok";\n',
      'utf-8',
    );

    try {
      const result = await scanProject({
        rootDir: projectDir,
        prodEntryPoints: ['src/server.ts'],
        importConventions: { prefer: 'absolute', aliasPrefix: '@/', root: 'src' },
        rules: [
          {
            entryPoints: ['src/server.ts'],
            deny: { modules: ['react'] },
            message: 'Server entry cannot import React',
          },
        ],
      });

      expect(result.importConventionViolations).toEqual([
        {
          file: 'src/server.ts',
          target: 'src/helper.ts',
          importSpecifier: './helper',
          suggestedSpecifier: '@/helper',
          expected: 'absolute',
          line: 2,
        },
      ]);
      expect(result.ruleValidation?.violations).toEqual([
        expect.objectContaining({
          source: 'src/server.ts',
          target: 'react',
          importSpecifier: 'react',
          entryPoint: 'src/server.ts',
          message: 'Server entry cannot import React',
        }),
      ]);
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  it('should resolve workspace package exports and imports maps', async () => {
    const projectDir = path.join(__dirname, 'tmp-workspace-exports-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'packages/app/src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'packages/lib/src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'packages/lib/src/features'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'packages/lib/src/internal'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['packages/*'] }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/app/package.json'),
      JSON.stringify({ name: '@repo/app' }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/lib/package.json'),
      JSON.stringify({
        name: '@repo/lib',
        exports: {
          './button': './src/Button.ts',
          './feature/*': {
            import: './src/features/*.ts',
            default: './src/features/*.ts',
          },
        },
        imports: {
          '#internal/*': './src/internal/*.ts',
        },
      }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/lib/src/Button.ts'),
      'import { internalValue } from "#internal/value";\nexport const Button = internalValue;\n',
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/lib/src/features/card.ts'),
      'export const Card = "card";\n',
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/lib/src/internal/value.ts'),
      'export const internalValue = "button";\n',
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/app/src/index.ts'),
      'import { Button } from "@repo/lib/button";\nimport { Card } from "@repo/lib/feature/card";\nexport const value = Button + Card;\n',
      'utf-8',
    );

    try {
      const result = await scanProject({ rootDir: projectDir });
      expect(
        result.graph.edges.some(
          (edge) =>
            edge.importSpecifier === '@repo/lib/button' &&
            edge.target.endsWith('packages/lib/src/Button.ts'),
        ),
      ).toBe(true);
      expect(
        result.graph.edges.some(
          (edge) =>
            edge.importSpecifier === '@repo/lib/feature/card' &&
            edge.target.endsWith('packages/lib/src/features/card.ts'),
        ),
      ).toBe(true);
      expect(
        result.graph.edges.some(
          (edge) =>
            edge.importSpecifier === '#internal/value' &&
            edge.target.endsWith('packages/lib/src/internal/value.ts'),
        ),
      ).toBe(true);
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  it('should optionally detect unused and unlisted npm dependencies', async () => {
    const projectDir = path.join(__dirname, 'tmp-unused-deps-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
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
      path.join(projectDir, 'src/index.ts'),
      [
        "import React from 'react';",
        "import '@scope/unlisted/subpath';",
        "import path from 'node:path';",
        'export const value = React.createElement("div", { id: path.sep });',
      ].join('\n'),
      'utf-8',
    );

    try {
      const result = await scanProject({
        rootDir: projectDir,
        detectUnusedDeps: true,
      });

      expect(result.dependencyIssues).toEqual({
        unused: ['lodash', 'vitest'],
        unlisted: ['@scope/unlisted'],
      });
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  it('should annotate workspace nodes and cross-package edges', async () => {
    const projectDir = path.join(__dirname, 'tmp-monorepo-project');
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(path.join(projectDir, 'packages/app/src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'packages/lib/src'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['packages/*'] }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/app/package.json'),
      JSON.stringify({ name: '@repo/app' }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/lib/package.json'),
      JSON.stringify({ name: '@repo/lib' }),
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/lib/src/index.ts'),
      'export function util() { return "ok"; }\n',
      'utf-8',
    );
    await fs.writeFile(
      path.join(projectDir, 'packages/app/src/index.ts'),
      'import { util } from "@repo/lib";\nexport const value = util();\n',
      'utf-8',
    );

    try {
      const result = await scanProject({ rootDir: projectDir });
      const appNode = result.graph.nodes.find(
        (node) => node.relativePath === 'packages/app/src/index.ts',
      );
      const libNode = result.graph.nodes.find(
        (node) => node.relativePath === 'packages/lib/src/index.ts',
      );
      const crossPackageEdge = result.graph.edges.find((edge) => edge.isCrossPackage);

      expect(appNode?.workspace).toBe('@repo/app');
      expect(libNode?.workspace).toBe('@repo/lib');
      expect(crossPackageEdge).toBeDefined();
      expect(crossPackageEdge?.importSpecifier).toBe('@repo/lib');
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true });
    }
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
    expect(result.graph.metadata.projectRoot).toBe(path.resolve(SIMPLE_PROJECT));
    expect(result.graph.metadata.depxrayVersion).toBe(packageJson.version);
  });
});
