import { describe, expect, it } from 'vitest';
import { parseExports } from '../src/parseExports.js';

describe('parseExports', () => {
  it('should parse named, default, type, re-export, and export-all declarations', () => {
    const code = [
      'export const usedValue = 1;',
      'export type SharedType = { value: string };',
      'export default function Feature() { return usedValue; }',
      "export { helper as helperAlias, type HelperType } from './helpers';",
      "export * from './widgets';",
    ].join('\n');

    expect(parseExports(code, 'feature.ts')).toEqual([
      { name: 'usedValue', kind: 'named', isTypeOnly: false, line: 1 },
      { name: 'SharedType', kind: 'named', isTypeOnly: true, line: 2 },
      { name: 'default', kind: 'default', isTypeOnly: false, line: 3 },
      {
        name: 'helperAlias',
        kind: 'reexport',
        isTypeOnly: false,
        line: 4,
        source: './helpers',
        sourceExportName: 'helper',
      },
      {
        name: 'HelperType',
        kind: 'reexport',
        isTypeOnly: true,
        line: 4,
        source: './helpers',
        sourceExportName: 'HelperType',
      },
      {
        name: '*',
        kind: 'export_all',
        isTypeOnly: false,
        line: 5,
        source: './widgets',
        sourceExportName: '*',
      },
    ]);
  });
});
