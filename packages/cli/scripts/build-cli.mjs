import * as path from 'node:path';
import { chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, '..');

await build({
  entryPoints: [path.join(cliDir, 'src/index.ts')],
  outfile: path.join(cliDir, 'dist/index.js'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  legalComments: 'none',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['node:*', 'chokidar', 'ws'],
});

await chmod(path.join(cliDir, 'dist/index.js'), 0o755);
