import type { ScanResult } from '@depxray/core';

function sarifLocation(file: string, line = 1) {
  return {
    physicalLocation: {
      artifactLocation: { uri: file },
      region: { startLine: Math.max(1, line || 1) },
    },
  };
}

export function formatAsSarif(result: ScanResult): string {
  const rules = [
    ['depxray/circular-dependency', 'Circular dependency'],
    ['depxray/orphan-file', 'Orphan file'],
    ['depxray/unused-export', 'Unused export'],
    ['depxray/unresolved-import', 'Unresolved import'],
    ['depxray/architecture-rule', 'Architecture rule violation'],
    ['depxray/dev-dependency-in-prod', 'DevDependency used in production'],
    ['depxray/import-convention', 'Import convention violation'],
  ].map(([id, name]) => ({ id, name, shortDescription: { text: name } }));
  const results: unknown[] = [];

  for (const chain of result.graph.circularDependencies) {
    results.push({
      ruleId: 'depxray/circular-dependency',
      level: 'error',
      message: { text: chain.description },
      locations: [sarifLocation(chain.chain[0] ?? result.graph.rootDir)],
    });
  }
  for (const file of result.orphanFiles) {
    results.push({
      ruleId: 'depxray/orphan-file',
      level: 'warning',
      message: { text: `Orphan file: ${file}` },
      locations: [sarifLocation(file)],
    });
  }
  for (const node of result.graph.nodes) {
    for (const item of node.unusedExports ?? []) {
      results.push({
        ruleId: 'depxray/unused-export',
        level: 'warning',
        message: { text: `Unused ${item.kind} export: ${item.name}` },
        locations: [sarifLocation(node.relativePath, item.line)],
      });
    }
  }
  for (const item of result.unresolvedImports) {
    results.push({
      ruleId: 'depxray/unresolved-import',
      level: 'error',
      message: { text: `Unresolved import: ${item.importSpecifier}` },
      locations: [sarifLocation(item.file, item.line)],
    });
  }
  for (const item of result.ruleValidation?.violations ?? []) {
    results.push({
      ruleId: 'depxray/architecture-rule',
      level: item.severity === 'error' ? 'error' : 'warning',
      message: { text: item.message },
      locations: [sarifLocation(item.source)],
    });
  }
  for (const item of result.devDepsInProd ?? []) {
    results.push({
      ruleId: 'depxray/dev-dependency-in-prod',
      level: 'error',
      message: { text: `Production path imports devDependency ${item.module}` },
      locations: [sarifLocation(item.file, item.line)],
    });
  }
  for (const item of result.importConventionViolations ?? []) {
    results.push({
      ruleId: 'depxray/import-convention',
      level: 'warning',
      message: {
        text: `Expected ${item.expected} import for ${item.importSpecifier}; use ${item.suggestedSpecifier}`,
      },
      locations: [sarifLocation(item.file, item.line)],
    });
  }

  return JSON.stringify(
    {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'depxray',
              informationUri: 'https://github.com/Pannawish/depxray',
              rules,
            },
          },
          results,
        },
      ],
    },
    null,
    2,
  );
}
