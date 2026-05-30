import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');

async function removeMaps(currentDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await removeMaps(entryPath);
      return;
    }

    if (entry.isFile() && entry.name.endsWith('.map')) {
      await fs.rm(entryPath, { force: true });
    }
  }));
}

await removeMaps(distDir);
