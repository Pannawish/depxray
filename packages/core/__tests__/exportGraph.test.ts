import { describe, it, expect } from 'vitest';
import packageJson from '../package.json';
import { exportGraphJSON } from '../src/exportGraph.js';
import { buildGraph } from '../src/buildGraph.js';
import type { ResolvedImport, ScanMetadata } from '../src/types.js';

const ROOT_DIR = '/test/project';

function makeMeta(): ScanMetadata {
  return {
    scannedAt: '2026-01-01T00:00:00.000Z',
    scanDurationMs: 123,
    projectRoot: ROOT_DIR,
    totalFiles: 2,
    totalEdges: 1,
    circularCount: 0,
    depxrayVersion: packageJson.version,
  };
}

describe('exportGraphJSON', () => {
  it('should produce valid JSON', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, [
      {
        raw: {
          source: './Button',
          specifiers: ['Button'],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
        resolvedPath: `${ROOT_DIR}/src/Button.tsx`,
      },
    ]);
    fileImports.set(`${ROOT_DIR}/src/Button.tsx`, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());
    const json = exportGraphJSON(graph);

    // Should be valid JSON
    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
  });

  it('should include version field', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, []);
    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    const parsed = JSON.parse(exportGraphJSON(graph));
    expect(parsed.version).toBe('1.0.0');
  });

  it('should include metadata', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, []);
    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    const parsed = JSON.parse(exportGraphJSON(graph));
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.depxrayVersion).toBe(packageJson.version);
    expect(parsed.metadata.projectRoot).toBe(ROOT_DIR);
  });

  it('should use relative paths in exported nodes', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, []);
    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    const parsed = JSON.parse(exportGraphJSON(graph));
    expect(parsed.nodes[0].relativePath).toBe('src/App.tsx');
    // ID should also be relative in the export
    expect(parsed.nodes[0].id).toBe('src/App.tsx');
  });

  it('should support compact output (no pretty print)', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, []);
    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());

    const compact = exportGraphJSON(graph, false);
    const pretty = exportGraphJSON(graph, true);

    // Compact should be shorter (no indentation)
    expect(compact.length).toBeLessThan(pretty.length);
    // Both should be valid JSON
    expect(JSON.parse(compact)).toBeDefined();
  });

  it('should include edges with relative paths', () => {
    const fileImports = new Map<string, ResolvedImport[]>();
    fileImports.set(`${ROOT_DIR}/src/App.tsx`, [
      {
        raw: {
          source: './Button',
          specifiers: ['Button'],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
        resolvedPath: `${ROOT_DIR}/src/Button.tsx`,
      },
    ]);
    fileImports.set(`${ROOT_DIR}/src/Button.tsx`, []);

    const graph = buildGraph(fileImports, ROOT_DIR, makeMeta());
    const parsed = JSON.parse(exportGraphJSON(graph));

    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].source).toBe('src/App.tsx');
    expect(parsed.edges[0].target).toBe('src/Button.tsx');
    expect(parsed.edges[0].importSpecifier).toBe('./Button');
  });
});
