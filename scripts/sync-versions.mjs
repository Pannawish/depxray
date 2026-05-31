import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const rootPackagePath = path.join(repoRoot, 'package.json');
const cliPackagePath = path.join(repoRoot, 'packages/cli/package.json');
const corePackagePath = path.join(repoRoot, 'packages/core/package.json');
const webUiPackagePath = path.join(repoRoot, 'packages/web-ui/package.json');
const lockfilePath = path.join(repoRoot, 'package-lock.json');

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const rootPackage = await readJson(rootPackagePath);
const version = rootPackage.version;

const cliPackage = await readJson(cliPackagePath);
cliPackage.version = version;
if (cliPackage.devDependencies?.['@depxray/core']) {
  cliPackage.devDependencies['@depxray/core'] = version;
}

const corePackage = await readJson(corePackagePath);
corePackage.version = version;

const webUiPackage = await readJson(webUiPackagePath);
webUiPackage.version = version;
if (webUiPackage.dependencies?.['@depxray/core']) {
  webUiPackage.dependencies['@depxray/core'] = version;
}

const lockfile = await readJson(lockfilePath);
lockfile.version = version;

if (lockfile.packages?.['']) {
  lockfile.packages[''].version = version;
}
if (lockfile.packages?.['packages/cli']) {
  lockfile.packages['packages/cli'].version = version;
  if (lockfile.packages['packages/cli'].devDependencies?.['@depxray/core']) {
    lockfile.packages['packages/cli'].devDependencies['@depxray/core'] = version;
  }
}
if (lockfile.packages?.['packages/core']) {
  lockfile.packages['packages/core'].version = version;
}
if (lockfile.packages?.['packages/web-ui']) {
  lockfile.packages['packages/web-ui'].version = version;
  if (lockfile.packages['packages/web-ui'].dependencies?.['@depxray/core']) {
    lockfile.packages['packages/web-ui'].dependencies['@depxray/core'] = version;
  }
}
if (lockfile.packages?.['node_modules/@depxray/core']) {
  lockfile.packages['node_modules/@depxray/core'].version = version;
}
if (lockfile.packages?.['node_modules/@depxray/web-ui']) {
  lockfile.packages['node_modules/@depxray/web-ui'].version = version;
}

await Promise.all([
  writeJson(cliPackagePath, cliPackage),
  writeJson(corePackagePath, corePackage),
  writeJson(webUiPackagePath, webUiPackage),
  writeJson(lockfilePath, lockfile),
]);

process.stdout.write(`Synced workspace package versions to ${version}\n`);
