import { parse, type ParserPlugin } from '@babel/parser';
import traverse from '@babel/traverse';
import type { FileMetrics } from './types.js';

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

function countLoc(sourceCode: string): number {
  return sourceCode.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

/**
 * Compute syntax-level metrics for a source file.
 */
export function computeFileMetrics(
  sourceCode: string,
  filePath: string,
): Omit<FileMetrics, 'instability'> {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    plugins: getParserPlugins(filePath),
  });

  let decisionPoints = 0;
  let exportCount = 0;

  traverse(ast, {
    IfStatement() {
      decisionPoints += 1;
    },
    ForStatement() {
      decisionPoints += 1;
    },
    ForInStatement() {
      decisionPoints += 1;
    },
    ForOfStatement() {
      decisionPoints += 1;
    },
    WhileStatement() {
      decisionPoints += 1;
    },
    DoWhileStatement() {
      decisionPoints += 1;
    },
    SwitchCase(path) {
      if (path.node.test) {
        decisionPoints += 1;
      }
    },
    CatchClause() {
      decisionPoints += 1;
    },
    ConditionalExpression() {
      decisionPoints += 1;
    },
    LogicalExpression(path) {
      if (['&&', '||', '??'].includes(path.node.operator)) {
        decisionPoints += 1;
      }
    },
    ExportDefaultDeclaration() {
      exportCount += 1;
    },
    ExportAllDeclaration() {
      exportCount += 1;
    },
    ExportNamedDeclaration(path) {
      if (path.node.specifiers.length > 0) {
        exportCount += path.node.specifiers.length;
        return;
      }

      if (path.node.declaration) {
        exportCount += 1;
      }
    },
  });

  return {
    loc: countLoc(sourceCode),
    cyclomaticComplexity: decisionPoints + 1,
    exportCount,
  };
}
