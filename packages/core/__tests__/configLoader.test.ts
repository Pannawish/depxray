import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { loadAliases } from '../src/configLoader.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');

describe('loadAliases', () => {
  it('should load path aliases from tsconfig.json', () => {
    const aliases = loadAliases(SIMPLE_PROJECT);

    expect(aliases.length).toBeGreaterThan(0);

    // Should have @/ alias
    const atAlias = aliases.find((a) => a.prefix === '@/');
    expect(atAlias).toBeDefined();
    expect(atAlias!.paths[0]).toContain('src');

    // Should have @components/ alias
    const compAlias = aliases.find((a) => a.prefix === '@components/');
    expect(compAlias).toBeDefined();
    expect(compAlias!.paths[0]).toContain('components');

    // Should have @utils/ alias
    const utilsAlias = aliases.find((a) => a.prefix === '@utils/');
    expect(utilsAlias).toBeDefined();
    expect(utilsAlias!.paths[0]).toContain('utils');
  });

  it('should return empty array when no tsconfig/jsconfig exists', () => {
    const aliases = loadAliases('/tmp/nonexistent-project');
    expect(aliases).toEqual([]);
  });

  it('should return empty array when no paths are configured', () => {
    // The circular-project fixture has no tsconfig
    const aliases = loadAliases(path.join(FIXTURES_DIR, 'circular-project'));
    expect(aliases).toEqual([]);
  });

  it('should resolve alias paths to absolute paths', () => {
    const aliases = loadAliases(SIMPLE_PROJECT);

    for (const alias of aliases) {
      for (const p of alias.paths) {
        expect(path.isAbsolute(p)).toBe(true);
      }
    }
  });
});
