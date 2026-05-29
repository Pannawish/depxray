import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { resolveImport } from '../src/resolveImports.js';
import { loadAliases } from '../src/configLoader.js';
import type { RawImportInfo, AliasMapping } from '../src/types.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const SRC_DIR = path.join(SIMPLE_PROJECT, 'src');

function makeRawImport(source: string, overrides?: Partial<RawImportInfo>): RawImportInfo {
  return {
    source,
    specifiers: [],
    isTypeOnly: false,
    isDynamic: false,
    line: 1,
    ...overrides,
  };
}

describe('resolveImport', () => {
  const aliases = loadAliases(SIMPLE_PROJECT);

  // ─── Relative imports ────────────────────────────────────────────────

  it('should resolve relative .tsx import', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('./components/Header');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBe(
      path.join(SRC_DIR, 'components', 'Header.tsx'),
    );
  });

  it('should resolve relative .ts import', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('./types');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBe(path.join(SRC_DIR, 'types.ts'));
  });

  it('should resolve parent-relative import (..)', () => {
    const importingFile = path.join(SRC_DIR, 'components', 'Header.tsx');
    const raw = makeRawImport('../types');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBe(path.join(SRC_DIR, 'types.ts'));
  });

  it('should resolve directory index file', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('./components');
    const result = resolveImport(raw, importingFile, aliases);

    // Should resolve to components/index.ts
    expect(result.resolvedPath).toBe(
      path.join(SRC_DIR, 'components', 'index.ts'),
    );
  });

  // ─── Alias imports ──────────────────────────────────────────────────

  it('should resolve @utils/ alias', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('@utils/helpers');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBe(
      path.join(SRC_DIR, 'utils', 'helpers.ts'),
    );
  });

  it('should resolve @components/ alias', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('@components/Header');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBe(
      path.join(SRC_DIR, 'components', 'Header.tsx'),
    );
  });

  // ─── External packages ─────────────────────────────────────────────

  it('should skip external packages (return null)', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('react');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBeNull();
    expect(result.error).toBe('external_package');
  });

  it('should skip scoped external packages', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('@mui/material');
    const result = resolveImport(raw, importingFile, aliases);

    // @mui/material doesn't match any alias, so it's external
    expect(result.resolvedPath).toBeNull();
  });

  // ─── Unresolvable ──────────────────────────────────────────────────

  it('should return null for unresolvable relative imports', () => {
    const importingFile = path.join(SRC_DIR, 'App.tsx');
    const raw = makeRawImport('./nonexistent');
    const result = resolveImport(raw, importingFile, aliases);

    expect(result.resolvedPath).toBeNull();
    expect(result.error).toContain('Could not resolve');
  });
});
