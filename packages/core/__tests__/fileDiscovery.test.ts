import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { discoverFiles } from '../src/fileDiscovery.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const SIMPLE_PROJECT = path.join(FIXTURES_DIR, 'simple-project');
const CIRCULAR_PROJECT = path.join(FIXTURES_DIR, 'circular-project');

describe('discoverFiles', () => {
  it('should find all .ts and .tsx files in simple-project', async () => {
    const files = await discoverFiles(SIMPLE_PROJECT);

    // Should find: App.tsx, types.ts, Header.tsx, Footer.tsx, index.ts,
    //              helpers.ts, Dashboard.tsx
    expect(files.length).toBe(7);

    // All files should be absolute paths
    for (const f of files) {
      expect(path.isAbsolute(f)).toBe(true);
    }
  });

  it('should only include files with specified extensions', async () => {
    const files = await discoverFiles(SIMPLE_PROJECT, ['.tsx']);

    // Only .tsx files: App.tsx, Header.tsx, Footer.tsx, Dashboard.tsx
    expect(files.length).toBe(4);
    for (const f of files) {
      expect(f).toMatch(/\.tsx$/);
    }
  });

  it('should ignore directories matching ignore patterns', async () => {
    // Create a node_modules dir in the fixture wouldn't be practical,
    // so we test that the default patterns don't cause errors
    const files = await discoverFiles(
      SIMPLE_PROJECT,
      ['.ts', '.tsx'],
      [
        'node_modules',
        'dist',
        'pages', // Ignore pages dir — should exclude Dashboard.tsx
      ],
    );

    // Should find everything except Dashboard.tsx (6 files)
    expect(files.length).toBe(6);
    const hasPages = files.some((f) => f.includes('/pages/'));
    expect(hasPages).toBe(false);
  });

  it('should respect maxDepth', async () => {
    // depth 0 = only files directly in the root src dir
    // But our fixture has files under src/, so depth 0 from the project root
    // would find nothing since all files are under src/
    const files = await discoverFiles(
      path.join(SIMPLE_PROJECT, 'src'),
      ['.ts', '.tsx'],
      [],
      0, // Only immediate children of src/
    );

    // Only App.tsx and types.ts are directly in src/
    expect(files.length).toBe(2);
  });

  it('should return sorted results', async () => {
    const files = await discoverFiles(SIMPLE_PROJECT);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it('should find files in circular-project', async () => {
    const files = await discoverFiles(CIRCULAR_PROJECT);

    // moduleA.ts, moduleB.ts, moduleC.ts, moduleD.ts, moduleE.ts, standalone.ts
    expect(files.length).toBe(6);
  });

  it('should handle non-existent directory gracefully', async () => {
    const files = await discoverFiles('/nonexistent/path/that/does/not/exist');
    expect(files).toEqual([]);
  });
});
