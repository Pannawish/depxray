/** @type {import('@depxray/core').DepxrayConfig} */
module.exports = {
  mode: 'dependencies',
  ignore: [
    'docs/archive',
    '**/__tests__/fixtures/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    'packages/web-ui/src/mockData.ts',
  ],
  extensions: ['.ts', '.tsx', '.mts', '.mjs'],
  entryPoints: [
    'packages/cli/src/index.ts',
    'packages/core/src/index.ts',
    'packages/mcp/src/index.ts',
    'packages/web-ui/src/main.tsx',
    'scripts/**/*.mjs',
    '**/*.config.*',
  ],
  circular: true,
  aliases: true,
  depth: 2,
};
