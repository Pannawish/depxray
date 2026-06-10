import { parse, type ParserPlugin } from '@babel/parser';
import traverse from '@babel/traverse';
import type { ExportSpecifier, Identifier, ObjectPattern, ArrayPattern, AssignmentPattern, RestElement, LVal } from '@babel/types';
import type { RawExportInfo } from './types.js';

function getParserPlugins(filePath: string): ParserPlugin[] {
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJSX = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

  const plugins: ParserPlugin[] = [
    'decorators-legacy',
    'dynamicImport',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'optionalChaining',
    'nullishCoalescingOperator',
    'exportDefaultFrom',
    'exportNamespaceFrom',
  ];

  if (isTypeScript) {
    plugins.push('typescript');
  }

  if (isJSX) {
    plugins.push('jsx');
  }

  return plugins;
}

function pushPatternNames(pattern: LVal, names: string[]): void {
  switch (pattern.type) {
    case 'Identifier':
      names.push(pattern.name);
      return;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        if (property.type === 'ObjectProperty') {
          pushPatternNames(property.value as LVal, names);
        } else if (property.type === 'RestElement') {
          pushPatternNames(property.argument as LVal, names);
        }
      }
      return;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element) {
          pushPatternNames(element as LVal, names);
        }
      }
      return;
    case 'AssignmentPattern':
      pushPatternNames(pattern.left, names);
      return;
    case 'RestElement':
      pushPatternNames(pattern.argument as LVal, names);
      return;
    default:
      return;
  }
}

function declarationNames(declaration: {
  type: string;
  declarations?: Array<{ id: LVal }>;
  id?: Identifier | null;
}): string[] {
  if (declaration.type === 'VariableDeclaration') {
    const names: string[] = [];
    for (const declarator of declaration.declarations ?? []) {
      pushPatternNames(declarator.id, names);
    }
    return names;
  }

  if (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'ClassDeclaration' ||
    declaration.type === 'TSTypeAliasDeclaration' ||
    declaration.type === 'TSInterfaceDeclaration' ||
    declaration.type === 'TSEnumDeclaration'
  ) {
    return declaration.id ? [declaration.id.name] : [];
  }

  return [];
}

function exportSpecifierName(specifier: ExportSpecifier): string {
  return specifier.exported.type === 'Identifier'
    ? specifier.exported.name
    : specifier.exported.value;
}

function sourceSpecifierName(specifier: ExportSpecifier): string {
  return 'name' in specifier.local
    ? specifier.local.name
    : specifier.exported.type === 'Identifier'
      ? specifier.exported.name
      : specifier.exported.value;
}

export function parseExports(sourceCode: string, filePath: string): RawExportInfo[] {
  let ast;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      plugins: getParserPlugins(filePath),
    });
  } catch {
    throw new Error(`Failed to parse ${filePath}`);
  }

  const exports: RawExportInfo[] = [];

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      exports.push({
        name: 'default',
        kind: 'default',
        isTypeOnly: false,
        line: path.node.loc?.start.line ?? 0,
      });
    },
    ExportNamedDeclaration(path) {
      const line = path.node.loc?.start.line ?? 0;
      const declaration = path.node.declaration;
      if (declaration) {
        const names = declarationNames(declaration as {
          type: string;
          declarations?: Array<{ id: LVal }>;
          id?: Identifier | null;
        });
        const isTypeOnly = (
          declaration.type === 'TSTypeAliasDeclaration' ||
          declaration.type === 'TSInterfaceDeclaration'
        );

        for (const name of names) {
          exports.push({
            name,
            kind: 'named',
            isTypeOnly,
            line,
          });
        }
        return;
      }

      if (path.node.source) {
        for (const specifier of path.node.specifiers) {
          if (specifier.type !== 'ExportSpecifier') {
            continue;
          }

          const exportKind = specifier.exportKind ?? path.node.exportKind;
          exports.push({
            name: exportSpecifierName(specifier),
            kind: 'reexport',
            isTypeOnly: exportKind === 'type',
            line,
            source: path.node.source.value,
            sourceExportName: sourceSpecifierName(specifier),
          });
        }
        return;
      }

      for (const specifier of path.node.specifiers) {
        if (specifier.type !== 'ExportSpecifier') {
          continue;
        }

        const exportKind = specifier.exportKind ?? path.node.exportKind;
        exports.push({
          name: exportSpecifierName(specifier),
          kind: 'named',
          isTypeOnly: exportKind === 'type',
          line,
        });
      }
    },
    ExportAllDeclaration(path) {
      exports.push({
        name: '*',
        kind: 'export_all',
        isTypeOnly: false,
        line: path.node.loc?.start.line ?? 0,
        source: path.node.source.value,
        sourceExportName: '*',
      });
    },
  });

  return exports;
}
