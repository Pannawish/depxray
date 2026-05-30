import { describe, expect, it } from 'vitest';
import {
  buildRelationshipIndex,
  filterDependencyEdges,
  getFolderSummary,
} from './relationshipIndex.js';
import type { ExplorerGraphSet } from './types.js';

const root = '/project';
const src = `${root}/src`;
const app = `${src}/App.tsx`;
const header = `${src}/Header.tsx`;
const types = `${src}/types.ts`;
const lazy = `${src}/Lazy.tsx`;
const external = `${root}/external.ts`;

function makeDataSet(): ExplorerGraphSet {
  return {
    schemaVersion: '1.0.0',
    generatedBy: 'test',
    projectRoot: root,
    scannedAt: '2026-05-30T00:00:00.000Z',
    availableModes: ['structure', 'dependencies'],
    defaultMode: 'structure',
    graphs: {
      structure: {
        schemaVersion: '1.0.0',
        mode: 'structure',
        projectRoot: root,
        scannedAt: '2026-05-30T00:00:00.000Z',
        totalFiles: 5,
        totalDirs: 2,
        totalImports: 5,
        circularCount: 0,
        generatedBy: 'test',
        errors: [],
        nodes: [
          {
            id: root,
            label: 'project',
            relativePath: '.',
            absolutePath: root,
            kind: 'directory',
            extension: null,
            depth: 0,
            collapsed: false,
            hidden: false,
            childCount: 2,
            descendantCount: 6,
          },
          {
            id: src,
            label: 'src',
            relativePath: 'src',
            absolutePath: src,
            kind: 'directory',
            extension: null,
            depth: 1,
            collapsed: false,
            hidden: false,
            childCount: 4,
            descendantCount: 4,
          },
          {
            id: app,
            label: 'App.tsx',
            relativePath: 'src/App.tsx',
            absolutePath: app,
            kind: 'file',
            extension: '.tsx',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
          },
          {
            id: header,
            label: 'Header.tsx',
            relativePath: 'src/Header.tsx',
            absolutePath: header,
            kind: 'file',
            extension: '.tsx',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
          },
          {
            id: types,
            label: 'types.ts',
            relativePath: 'src/types.ts',
            absolutePath: types,
            kind: 'file',
            extension: '.ts',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
          },
          {
            id: lazy,
            label: 'Lazy.tsx',
            relativePath: 'src/Lazy.tsx',
            absolutePath: lazy,
            kind: 'file',
            extension: '.tsx',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
          },
          {
            id: external,
            label: 'external.ts',
            relativePath: 'external.ts',
            absolutePath: external,
            kind: 'file',
            extension: '.ts',
            depth: 1,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
          },
        ],
        edges: [
          { id: `${root}->${src}`, source: root, target: src, kind: 'structure' },
          { id: `${root}->${external}`, source: root, target: external, kind: 'structure' },
          { id: `${src}->${app}`, source: src, target: app, kind: 'structure' },
          { id: `${src}->${header}`, source: src, target: header, kind: 'structure' },
          { id: `${src}->${types}`, source: src, target: types, kind: 'structure' },
          { id: `${src}->${lazy}`, source: src, target: lazy, kind: 'structure' },
        ],
      },
      dependencies: {
        schemaVersion: '1.0.0',
        mode: 'dependencies',
        projectRoot: root,
        scannedAt: '2026-05-30T00:00:00.000Z',
        totalFiles: 5,
        totalDirs: 0,
        totalImports: 5,
        circularCount: 2,
        generatedBy: 'test',
        errors: [],
        nodes: [
          {
            id: app,
            label: 'App.tsx',
            relativePath: 'src/App.tsx',
            absolutePath: app,
            kind: 'file',
            extension: '.tsx',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 3,
            descendantCount: 3,
            inDegree: 1,
            outDegree: 3,
            isCircular: true,
          },
          {
            id: header,
            label: 'Header.tsx',
            relativePath: 'src/Header.tsx',
            absolutePath: header,
            kind: 'file',
            extension: '.tsx',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 1,
            descendantCount: 1,
            inDegree: 1,
            outDegree: 1,
            isCircular: true,
          },
          {
            id: types,
            label: 'types.ts',
            relativePath: 'src/types.ts',
            absolutePath: types,
            kind: 'file',
            extension: '.ts',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
            inDegree: 1,
            outDegree: 0,
            isCircular: false,
          },
          {
            id: lazy,
            label: 'Lazy.tsx',
            relativePath: 'src/Lazy.tsx',
            absolutePath: lazy,
            kind: 'file',
            extension: '.tsx',
            depth: 2,
            collapsed: false,
            hidden: false,
            childCount: 0,
            descendantCount: 0,
            inDegree: 1,
            outDegree: 0,
            isCircular: false,
          },
          {
            id: external,
            label: 'external.ts',
            relativePath: 'external.ts',
            absolutePath: external,
            kind: 'file',
            extension: '.ts',
            depth: 1,
            collapsed: false,
            hidden: false,
            childCount: 1,
            descendantCount: 1,
            inDegree: 0,
            outDegree: 1,
            isCircular: false,
          },
        ],
        edges: [
          {
            id: 'app-header',
            source: app,
            target: header,
            kind: 'dependencies',
            importSpecifier: './Header',
            importedNames: ['Header'],
            isTypeOnly: false,
            isDynamic: false,
          },
          {
            id: 'header-app',
            source: header,
            target: app,
            kind: 'dependencies',
            importSpecifier: './App',
            importedNames: ['App'],
            isTypeOnly: false,
            isDynamic: false,
          },
          {
            id: 'app-types',
            source: app,
            target: types,
            kind: 'dependencies',
            importSpecifier: './types',
            importedNames: ['AppProps'],
            isTypeOnly: true,
            isDynamic: false,
          },
          {
            id: 'app-lazy',
            source: app,
            target: lazy,
            kind: 'dependencies',
            importSpecifier: './Lazy',
            importedNames: [],
            isTypeOnly: false,
            isDynamic: true,
          },
          {
            id: 'external-header',
            source: external,
            target: header,
            kind: 'dependencies',
            importSpecifier: './src/Header',
            importedNames: ['Header'],
            isTypeOnly: false,
            isDynamic: false,
          },
        ],
      },
    },
  };
}

describe('relationship index', () => {
  it('builds tree and dependency lookup maps', () => {
    const index = buildRelationshipIndex(makeDataSet());

    expect(index.rootId).toBe(root);
    expect(index.nodeById.get(app)?.outDegree).toBe(3);
    expect(index.childrenByParentId.get(src)?.map((node) => node.relativePath)).toEqual([
      'src/App.tsx',
      'src/Header.tsx',
      'src/Lazy.tsx',
      'src/types.ts',
    ]);
    expect(index.importsBySourceId.get(app)?.map((edge) => edge.id)).toEqual([
      'app-header',
      'app-types',
      'app-lazy',
    ]);
    expect(index.importedByTargetId.get(header)?.map((edge) => edge.id)).toEqual([
      'app-header',
      'external-header',
    ]);
    expect(Array.from(index.circularNodeIds)).toEqual([app, header]);
  });

  it('filters type-only and dynamic edges', () => {
    const index = buildRelationshipIndex(makeDataSet());
    const filtered = filterDependencyEdges(index.importsBySourceId.get(app) ?? [], {
      showTypeOnlyEdges: false,
      showDynamicEdges: false,
      circularOnly: false,
    });

    expect(filtered.map((edge) => edge.id)).toEqual(['app-header']);
  });

  it('summarizes folder internal and external relationships', () => {
    const index = buildRelationshipIndex(makeDataSet());
    const summary = getFolderSummary(src, index);

    expect(summary.totalFiles).toBe(4);
    expect(summary.directChildren).toBe(4);
    expect(summary.descendants).toBe(4);
    expect(summary.internalImports.map((edge) => edge.id)).toEqual([
      'app-header',
      'header-app',
      'app-types',
      'app-lazy',
    ]);
    expect(summary.incomingExternal.map((edge) => edge.id)).toEqual(['external-header']);
    expect(summary.outgoingExternal).toEqual([]);
    expect(summary.circularFiles.map((node) => node.id)).toEqual([app, header]);
  });
});
