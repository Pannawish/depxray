import { build } from 'esbuild';

await build({
  entryPoints: ['src/graphContract.ts'],
  outfile: 'dist/graphContract.mjs',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
});
