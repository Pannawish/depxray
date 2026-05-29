// ============================================================================
// parseImports — Extract import statements from a file's AST
// ============================================================================
// Uses @babel/parser to parse JavaScript/TypeScript files into an AST,
// then @babel/traverse to walk the tree and extract all import statements.
//
// Handles:
//   - Static imports:     import X from './Y'
//   - Named imports:      import { A, B } from './Y'
//   - Namespace imports:  import * as X from './Y'
//   - Type-only imports:  import type { X } from './Y'
//   - Re-exports:         export { X } from './Y'
//   - Barrel re-exports:  export * from './Y'
//   - Dynamic imports:    const X = await import('./Y')
//   - CommonJS require:   const X = require('./Y')
// ============================================================================

import { parse, type ParserPlugin } from '@babel/parser';
import traverse from '@babel/traverse';
import type { RawImportInfo } from './types.js';

/**
 * Determine which Babel parser plugins to enable based on file extension.
 *
 * - `.ts` / `.tsx` files get the `typescript` plugin
 * - `.jsx` / `.tsx` files get the `jsx` plugin
 * - TypeScript files cannot use both `typescript` and `flow` plugins
 */
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

/**
 * Parse a source file and extract all import information.
 *
 * This function does NOT resolve paths — it only extracts the raw import
 * specifiers as they appear in the source code. Path resolution is handled
 * separately by `resolveImports.ts`.
 *
 * @param sourceCode - The full text content of the file
 * @param filePath   - Absolute path to the file (used to determine parser plugins)
 * @returns Array of raw import information, one entry per import statement
 *
 * @example
 * ```typescript
 * const code = `
 *   import React from 'react';
 *   import { Button } from './components/Button';
 *   import type { Props } from './types';
 * `;
 * const imports = parseImports(code, '/project/src/App.tsx');
 * // Returns:
 * // [
 * //   { source: 'react', specifiers: ['React'], isTypeOnly: false, isDynamic: false, line: 2 },
 * //   { source: './components/Button', specifiers: ['Button'], isTypeOnly: false, isDynamic: false, line: 3 },
 * //   { source: './types', specifiers: ['Props'], isTypeOnly: true, isDynamic: false, line: 4 },
 * // ]
 * ```
 */
export function parseImports(
  sourceCode: string,
  filePath: string,
): RawImportInfo[] {
  const plugins = getParserPlugins(filePath);

  // Parse the source code into an AST.
  // We wrap this in try/catch because some files may have syntax errors.
  let ast;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      // Allow both import/export and require() in the same file
      allowImportExportEverywhere: true,
      plugins,
    });
  } catch {
    // If parsing fails, return an empty array.
    // The caller (scanProject) will record this as a ScanError.
    throw new Error(`Failed to parse ${filePath}`);
  }

  const imports: RawImportInfo[] = [];

  // Walk the AST and collect all import-like statements.
  traverse(ast, {
    // ─── Static imports ──────────────────────────────────────────────
    // Matches: import X from './Y'
    //          import { A, B } from './Y'
    //          import * as X from './Y'
    //          import type { X } from './Y'
    //          import './side-effect'
    ImportDeclaration(path) {
      const specifiers = path.node.specifiers.map((s) => {
        if (s.type === 'ImportDefaultSpecifier') {
          return s.local.name;
        }
        if (s.type === 'ImportNamespaceSpecifier') {
          return `* as ${s.local.name}`;
        }
        // ImportSpecifier
        return s.local.name;
      });

      imports.push({
        source: path.node.source.value,
        specifiers,
        isTypeOnly: path.node.importKind === 'type',
        isDynamic: false,
        line: path.node.loc?.start.line ?? 0,
      });
    },

    // ─── Re-exports ──────────────────────────────────────────────────
    // Matches: export { X } from './Y'
    //          export { default as X } from './Y'
    //          export type { X } from './Y'
    ExportNamedDeclaration(path) {
      if (path.node.source) {
        const specifiers = path.node.specifiers.map((s) => {
          if (s.type === 'ExportSpecifier') {
            const exported = s.exported;
            return exported.type === 'Identifier'
              ? exported.name
              : exported.value;
          }
          return '';
        });

        imports.push({
          source: path.node.source.value,
          specifiers: specifiers.filter(Boolean),
          isTypeOnly: path.node.exportKind === 'type',
          isDynamic: false,
          line: path.node.loc?.start.line ?? 0,
        });
      }
    },

    // ─── Barrel re-exports ───────────────────────────────────────────
    // Matches: export * from './Y'
    ExportAllDeclaration(path) {
      imports.push({
        source: path.node.source.value,
        specifiers: ['*'],
        isTypeOnly: false,
        isDynamic: false,
        line: path.node.loc?.start.line ?? 0,
      });
    },

    // ─── Dynamic imports and require() ───────────────────────────────
    // Matches: import('./Y')              — dynamic import
    //          const X = require('./Y')   — CommonJS require
    CallExpression(path) {
      // Dynamic import: import('./Y')
      if (
        path.node.callee.type === 'Import' &&
        path.node.arguments.length > 0 &&
        path.node.arguments[0].type === 'StringLiteral'
      ) {
        imports.push({
          source: path.node.arguments[0].value,
          specifiers: [],
          isTypeOnly: false,
          isDynamic: true,
          line: path.node.loc?.start.line ?? 0,
        });
        return;
      }

      // CommonJS require: require('./Y')
      if (
        path.node.callee.type === 'Identifier' &&
        path.node.callee.name === 'require' &&
        path.node.arguments.length > 0 &&
        path.node.arguments[0].type === 'StringLiteral'
      ) {
        imports.push({
          source: path.node.arguments[0].value,
          specifiers: [],
          isTypeOnly: false,
          isDynamic: false,
          line: path.node.loc?.start.line ?? 0,
        });
      }
    },
  });

  return imports;
}
