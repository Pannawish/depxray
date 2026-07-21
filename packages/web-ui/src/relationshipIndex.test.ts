import { describe, expect, it } from 'vitest';
import {
  buildRelationshipIndex,
  filterDependencyEdges,
  getFolderSummary,
  getImpactSummary,
} from './relationshipIndex.js';
import {
  getFileNeighborhoodGraph,
  getFolderBoundaryGraph,
  getGraphBreadcrumbs,
  getShortestDependencyPath,
} from './graphScope.js';
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
        totalImports: 0,
        circularCount: 0,
        circularDependencies: [],
        orphanFiles: [],
        unresolvedImports: [],
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
        circularDependencies: [
          {
            chain: ['src/App.tsx', 'src/Header.tsx', 'src/App.tsx'],
            description: 'src/App.tsx -> src/Header.tsx -> src/App.tsx',
          },
        ],
        orphanFiles: ['external.ts'],
        unresolvedImports: [],
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
            workspace: '@repo/app',
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
            workspace: '@repo/app',
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
            isOrphan: true,
            workspace: '@repo/tools',
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
            isCrossPackage: true,
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
    expect(Array.from(index.orphanNodeIds)).toEqual([external]);
    expect(index.nodeById.get(external)?.isOrphan).toBe(true);
    expect(index.nodeById.get(app)?.workspace).toBe('@repo/app');
    expect(index.nodeById.get(external)?.workspace).toBe('@repo/tools');
  });

  it('preserves dependency health data for the dashboard view', () => {
    const dataSet = makeDataSet();
    dataSet.graphs.dependencies!.healthScore = {
      grade: 'B',
      score: 84,
      issues: {
        circularChains: 1,
        orphanFiles: 1,
        unusedExports: 2,
        unresolvedImports: 0,
        ruleViolations: 0,
      },
      hotspots: [{ file: 'src/App.tsx', complexity: 8, loc: 42 }],
      hubs: [{ file: 'src/Header.tsx', inDegree: 4, outDegree: 1 }],
    };

    const index = buildRelationshipIndex(dataSet);

    expect(index.dependencyGraph?.healthScore?.grade).toBe('B');
    expect(index.dependencyGraph?.healthScore?.hotspots[0]).toEqual({
      file: 'src/App.tsx',
      complexity: 8,
      loc: 42,
    });
    expect(index.nodeById.get(app)?.relativePath).toBe('src/App.tsx');
  });

  it('filters type-only and dynamic edges', () => {
    const index = buildRelationshipIndex(makeDataSet());
    const filtered = filterDependencyEdges(index.importsBySourceId.get(app) ?? [], {
      showTypeOnlyEdges: false,
      showDynamicEdges: false,
      circularOnly: false,
      orphanOnly: false,
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
    expect(summary.incomingExternal[0].isCrossPackage).toBe(true);
    expect(summary.outgoingExternal).toEqual([]);
    expect(summary.circularFiles.map((node) => node.id)).toEqual([app, header]);
    expect(summary.orphanFiles).toEqual([]);
  });

  it('summarizes orphan files under folders', () => {
    const index = buildRelationshipIndex(makeDataSet());
    const summary = getFolderSummary(root, index);

    expect(summary.orphanFiles.map((node) => node.id)).toEqual([external]);
  });

  it('summarizes transitive dependency impact for a selected file', () => {
    const index = buildRelationshipIndex(makeDataSet());
    const summary = getImpactSummary(types, index);

    expect(summary?.targetNodeId).toBe(types);
    expect(summary?.directDependentCount).toBe(1);
    expect(summary?.affectedFiles.map((item) => item.node.id)).toEqual([app, header, external]);
    expect(summary?.impactNodeIds.has(types)).toBe(true);
    expect(summary?.impactEdgeIds.has('app-types')).toBe(true);
    expect(summary?.affectedFiles.find((item) => item.node.id === external)?.path.map((node) => node.id)).toEqual([
      external,
      header,
      app,
      types,
    ]);
  });

  it('builds direct and two-level file dependency neighborhoods', () => {
    const index = buildRelationshipIndex(makeDataSet());
    const direct = getFileNeighborhoodGraph(header, index, 1);
    const twoLevels = getFileNeighborhoodGraph(header, index, 2);

    expect(direct.nodes.map((node) => node.id)).toEqual([external, app, header]);
    expect(direct.nodes.find((node) => node.id === header)?.scopeRole).toBe('focus');
    expect(direct.nodes.find((node) => node.id === external)?.scopeRole).toBe('dependent');
    expect(direct.edges.map((edge) => edge.id)).toEqual([
      'external-header',
      'app-header',
      'header-app',
    ]);
    expect(twoLevels.nodes.map((node) => node.id)).toEqual([
      external,
      app,
      header,
      lazy,
      types,
    ]);
  });

  it('builds folder boundary graphs with collapsed child folders and aggregated edges', () => {
    const dataSet = makeDataSet();
    const components = `${src}/components`;
    const structure = dataSet.graphs.structure!;
    structure.nodes.push({
      id: components,
      label: 'components',
      relativePath: 'src/components',
      absolutePath: components,
      kind: 'directory',
      extension: null,
      depth: 2,
      collapsed: false,
      hidden: false,
      childCount: 1,
      descendantCount: 1,
    });
    structure.edges = structure.edges
      .filter((edge) => edge.id !== `${src}->${header}`)
      .concat([
        { id: `${src}->${components}`, source: src, target: components, kind: 'structure' },
        { id: `${components}->${header}`, source: components, target: header, kind: 'structure' },
      ]);

    const index = buildRelationshipIndex(dataSet);
    const graph = getFolderBoundaryGraph(src, index, 'all');
    const componentCluster = graph.nodes.find((node) => node.id === components);

    expect(graph.focusNodeId).toBe(src);
    expect(graph.nodes.some((node) => node.id === header)).toBe(false);
    expect(componentCluster?.memberNodeIds).toEqual([header]);
    expect(componentCluster?.memberCount).toBe(1);
    expect(graph.nodes.find((node) => node.id === external)?.scopeRole).toBe('external-incoming');
    expect(graph.edges.find((edge) => edge.id === `scope:incoming:${external}->${components}`)).toMatchObject({
      aggregateCount: 1,
      memberEdgeIds: ['external-header'],
    });
    expect(graph.edges.some((edge) => edge.scopeRole === 'membership' && edge.target === components)).toBe(true);
  });

  it('returns graph breadcrumbs and the shortest dependency path in either direction', () => {
    const index = buildRelationshipIndex(makeDataSet());

    expect(getGraphBreadcrumbs(header, index).map((item) => item.id)).toEqual([
      root,
      src,
      header,
    ]);
    expect(getShortestDependencyPath(header, types, index)).toEqual({
      connected: true,
      direction: 'forward',
      nodeIds: [header, app, types],
      edgeIds: ['header-app', 'app-types'],
    });
    expect(getShortestDependencyPath(types, external, index)).toEqual({
      connected: true,
      direction: 'reverse',
      nodeIds: [external, header, app, types],
      edgeIds: ['external-header', 'header-app', 'app-types'],
    });
  });
});
