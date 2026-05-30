import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, '..');
const webUiDistDir = path.resolve(cliDir, '../web-ui/dist');
const bundledWebUiDir = path.resolve(cliDir, 'dist/web-ui');

async function ensureWebUiBuild() {
  try {
    const stat = await fs.stat(webUiDistDir);
    if (!stat.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(
      `Web UI build not found at ${webUiDistDir}. Run "npm run build --workspace @rdg/web-ui" first.`,
    );
  }
}

async function bundleWebUi() {
  await ensureWebUiBuild();
  await fs.rm(bundledWebUiDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(bundledWebUiDir), { recursive: true });
  await fs.cp(webUiDistDir, bundledWebUiDir, { recursive: true });
  process.stdout.write(`Bundled web UI assets into ${bundledWebUiDir}\n`);
}

bundleWebUi().catch((error) => {
  console.error((error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
