import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const rootPackagePath = path.join(repoRoot, 'package.json');
const lockfilePath = path.join(repoRoot, 'package-lock.json');
const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function packageExists(packageDir) {
  try {
    await fs.access(path.join(packageDir, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

async function expandWorkspacePattern(pattern) {
  if (!pattern.includes('*')) {
    const absoluteDir = path.resolve(repoRoot, pattern);
    return (await packageExists(absoluteDir)) ? [absoluteDir] : [];
  }

  const wildcardIndex = pattern.indexOf('*');
  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);
  const baseDir = path.resolve(repoRoot, prefix);
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const workspaceDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.resolve(baseDir, entry.name, suffix);
    if (await packageExists(candidate)) {
      workspaceDirs.push(candidate);
    }
  }

  return workspaceDirs;
}

async function getWorkspacePackageDirs(rootPackage) {
  const workspacePatterns = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : (rootPackage.workspaces?.packages ?? []);
  const expanded = await Promise.all(workspacePatterns.map(expandWorkspacePattern));
  return [...new Set(expanded.flat())].sort((a, b) => a.localeCompare(b));
}

function syncInternalDependencies(packageJson, workspaceNames, version) {
  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies) {
      continue;
    }

    for (const dependencyName of Object.keys(dependencies)) {
      if (workspaceNames.has(dependencyName)) {
        dependencies[dependencyName] = version;
      }
    }
  }
}

function lockfileKeyForPackageName(packageName) {
  return `node_modules/${packageName}`;
}

function removeNestedWorkspacePackages(lockfile, workspaceEntries) {
  const nestedPackagePaths = [];

  for (const { relativeDir } of workspaceEntries) {
    for (const { name } of workspaceEntries) {
      const nestedPackagePath = `${relativeDir}/node_modules/${name}`;
      if (lockfile.packages?.[nestedPackagePath]) {
        delete lockfile.packages[nestedPackagePath];
      }
      nestedPackagePaths.push(path.join(repoRoot, relativeDir, 'node_modules', ...name.split('/')));
    }
  }

  return nestedPackagePaths;
}

const rootPackage = await readJson(rootPackagePath);
const version = rootPackage.version;
const workspaceDirs = await getWorkspacePackageDirs(rootPackage);
const workspaceEntries = await Promise.all(
  workspaceDirs.map(async (workspaceDir) => {
    const packagePath = path.join(workspaceDir, 'package.json');
    const packageJson = await readJson(packagePath);
    return {
      name: packageJson.name,
      packageJson,
      packagePath,
      relativeDir: path.relative(repoRoot, workspaceDir).replaceAll('\\', '/'),
    };
  }),
);
const workspaceNames = new Set(workspaceEntries.map((entry) => entry.name));

for (const entry of workspaceEntries) {
  entry.packageJson.version = version;
  syncInternalDependencies(entry.packageJson, workspaceNames, version);
}

const lockfile = await readJson(lockfilePath);
lockfile.version = version;

if (lockfile.packages?.['']) {
  lockfile.packages[''].version = version;
}

for (const entry of workspaceEntries) {
  const workspaceLockPackage = lockfile.packages?.[entry.relativeDir];
  if (workspaceLockPackage) {
    workspaceLockPackage.version = version;
    syncInternalDependencies(workspaceLockPackage, workspaceNames, version);
  }

  const nodeModulesLockPackage = lockfile.packages?.[lockfileKeyForPackageName(entry.name)];
  if (nodeModulesLockPackage) {
    nodeModulesLockPackage.version = version;
    syncInternalDependencies(nodeModulesLockPackage, workspaceNames, version);
  }
}

const nestedPackagePaths = removeNestedWorkspacePackages(lockfile, workspaceEntries);

await Promise.all([
  ...workspaceEntries.map((entry) => writeJson(entry.packagePath, entry.packageJson)),
  writeJson(lockfilePath, lockfile),
  ...nestedPackagePaths.map((nestedPackagePath) =>
    fs.rm(nestedPackagePath, { recursive: true, force: true }),
  ),
]);

process.stdout.write(`Synced workspace package versions to ${version}\n`);
