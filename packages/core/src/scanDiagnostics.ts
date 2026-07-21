import * as path from 'path';
import { matchesAnyPattern } from './detectOrphanFiles.js';
import { normalizePackageName } from './detectUnusedDeps.js';
import type {
  ArchitectureRule,
  DependencyGraph,
  DevDependencyInProd,
  ImportConventionViolation,
  ResolvedImport,
  RuleValidationResult,
  RuleViolation,
  ScanOptions,
} from './types.js';

function normalizeRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replaceAll('\\', '/');
}

function normalizeImportSpecifier(specifier: string): string {
  return specifier.startsWith('.') ? specifier : specifier.replace(/\/$/, '');
}

function withoutKnownSourceExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|ts|jsx|js)$/i, '');
}

function relativeImportSpecifier(fromFile: string, toFile: string): string {
  const relative = withoutKnownSourceExtension(
    path.relative(path.dirname(fromFile), toFile).replaceAll('\\', '/'),
  );
  return normalizeImportSpecifier(relative.startsWith('.') ? relative : `./${relative}`);
}

function absoluteAliasSpecifier(
  rootDir: string,
  targetFile: string,
  aliasPrefix = '@/',
  sourceRoot = 'src',
): string | null {
  const relative = path
    .relative(path.resolve(rootDir, sourceRoot), targetFile)
    .replaceAll('\\', '/');
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return normalizeImportSpecifier(`${aliasPrefix}${withoutKnownSourceExtension(relative)}`);
}

function findEntryPointNodes(graph: DependencyGraph, patterns: string[]) {
  return graph.nodes.filter((node) => matchesAnyPattern(node.relativePath, patterns));
}

function buildReachabilityFromEntries(
  graph: DependencyGraph,
  entryPoints: Array<{ id: string; relativePath: string }>,
): Map<string, Set<string>> {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }

  const reachableByFile = new Map<string, Set<string>>();
  for (const entryPoint of entryPoints) {
    const visited = new Set<string>();
    const queue = [entryPoint.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      reachableByFile.set(
        current,
        new Set([...(reachableByFile.get(current) ?? []), entryPoint.relativePath]),
      );
      queue.push(...(adjacency.get(current) ?? []));
    }
  }
  return reachableByFile;
}

export function detectImportConventionViolations(
  rootDir: string,
  edges: DependencyGraph['edges'],
  fileImportsMap: Map<string, ResolvedImport[]>,
  config: NonNullable<ScanOptions['importConventions']>,
): ImportConventionViolation[] {
  const prefer = config.prefer ?? 'absolute';
  const violations: ImportConventionViolation[] = [];
  for (const edge of edges) {
    const line =
      fileImportsMap
        .get(edge.source)
        ?.find(
          (item) => item.resolvedPath === edge.target && item.raw.source === edge.importSpecifier,
        )?.raw.line ?? 0;
    const isRelative = edge.importSpecifier.startsWith('.');
    const suggestedSpecifier =
      prefer === 'absolute'
        ? absoluteAliasSpecifier(
            rootDir,
            edge.target,
            config.aliasPrefix ?? '@/',
            config.root ?? 'src',
          )
        : relativeImportSpecifier(edge.source, edge.target);
    if (
      (prefer === 'absolute' && !isRelative) ||
      (prefer === 'relative' && isRelative) ||
      !suggestedSpecifier ||
      suggestedSpecifier === edge.importSpecifier
    )
      continue;
    violations.push({
      file: normalizeRelativePath(rootDir, edge.source),
      target: normalizeRelativePath(rootDir, edge.target),
      importSpecifier: edge.importSpecifier,
      suggestedSpecifier,
      expected: prefer,
      line,
    });
  }
  return violations.sort(
    (a, b) => a.file.localeCompare(b.file) || a.importSpecifier.localeCompare(b.importSpecifier),
  );
}

export function detectDevDepsInProd(
  rootDir: string,
  graph: DependencyGraph,
  fileImportsMap: Map<string, ResolvedImport[]>,
  packageJson: { devDependencies?: Record<string, string> },
  prodEntryPointPatterns: string[],
  devEntryPointPatterns: string[] = [],
  ignoreTypeImports = false,
): DevDependencyInProd[] {
  const devDependencies = new Set(Object.keys(packageJson.devDependencies ?? {}));
  if (devDependencies.size === 0 || prodEntryPointPatterns.length === 0) return [];

  const reachableByFile = buildReachabilityFromEntries(
    graph,
    findEntryPointNodes(graph, prodEntryPointPatterns),
  );
  const findings: DevDependencyInProd[] = [];
  const seen = new Set<string>();
  for (const [filePath, entryPoints] of reachableByFile) {
    const relativeFile = normalizeRelativePath(rootDir, filePath);
    if (matchesAnyPattern(relativeFile, devEntryPointPatterns)) continue;
    for (const item of fileImportsMap.get(filePath) ?? []) {
      if (item.error !== 'external_package' || (ignoreTypeImports && item.raw.isTypeOnly)) continue;
      const module = normalizePackageName(item.raw.source);
      if (!module || !devDependencies.has(module)) continue;
      for (const entryPoint of entryPoints) {
        const key = `${relativeFile}:${item.raw.line}:${module}:${entryPoint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          file: relativeFile,
          module,
          importSpecifier: item.raw.source,
          line: item.raw.line,
          entryPoint,
          isTypeOnly: item.raw.isTypeOnly,
        });
      }
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.module.localeCompare(b.module));
}

export function detectScopedRestrictedImports(
  rootDir: string,
  graph: DependencyGraph,
  fileImportsMap: Map<string, ResolvedImport[]>,
  rules: ArchitectureRule[] = [],
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const seen = new Set<string>();
  for (const rule of rules.filter((item) => item.entryPoints?.length && item.deny)) {
    const reachableByFile = buildReachabilityFromEntries(
      graph,
      findEntryPointNodes(graph, rule.entryPoints ?? []),
    );
    for (const edge of graph.edges) {
      const sourceEntryPoints = reachableByFile.get(edge.source);
      const target = normalizeRelativePath(rootDir, edge.target);
      if (!sourceEntryPoints || !matchesAnyPattern(target, rule.deny?.files ?? [])) continue;
      const source = normalizeRelativePath(rootDir, edge.source);
      for (const entryPoint of sourceEntryPoints) {
        const key = `${entryPoint}:${source}:${target}:${edge.importSpecifier}`;
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push({
          source,
          target,
          importSpecifier: edge.importSpecifier,
          from: rule.entryPoints?.join(', ') ?? '',
          to: (rule.deny?.files ?? []).join(', '),
          entryPoint,
          severity: rule.severity === 'warning' ? 'warning' : 'error',
          message: rule.message ?? 'Restricted import for entry point',
        });
      }
    }

    for (const [filePath, resolvedImports] of fileImportsMap) {
      const sourceEntryPoints = reachableByFile.get(filePath);
      if (!sourceEntryPoints) continue;
      const source = normalizeRelativePath(rootDir, filePath);
      for (const item of resolvedImports) {
        if (item.error !== 'external_package') continue;
        const module = normalizePackageName(item.raw.source) ?? item.raw.source;
        const deniedModules = rule.deny?.modules ?? [];
        if (
          !deniedModules.some(
            (pattern) =>
              pattern === module ||
              pattern === item.raw.source ||
              matchesAnyPattern(module, [pattern]),
          )
        )
          continue;
        for (const entryPoint of sourceEntryPoints) {
          const key = `${entryPoint}:${source}:${module}:${item.raw.line}`;
          if (seen.has(key)) continue;
          seen.add(key);
          violations.push({
            source,
            target: module,
            importSpecifier: item.raw.source,
            from: rule.entryPoints?.join(', ') ?? '',
            to: deniedModules.join(', '),
            entryPoint,
            severity: rule.severity === 'warning' ? 'warning' : 'error',
            message: rule.message ?? 'Restricted import for entry point',
          });
        }
      }
    }
  }
  return violations;
}

export function mergeRuleValidation(
  validation: RuleValidationResult | undefined,
  extraViolations: RuleViolation[],
): RuleValidationResult | undefined {
  if (!validation && extraViolations.length === 0) return undefined;
  const violations = [...(validation?.violations ?? []), ...extraViolations];
  return {
    violations,
    errorCount: violations.filter((item) => item.severity === 'error').length,
    warningCount: violations.filter((item) => item.severity === 'warning').length,
  };
}
