import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';

interface InitCommandOptions {
  defaults?: boolean;
  force?: boolean;
}

const DEFAULT_CONFIG = `/** @type {import('@depxray/core').DepxrayConfig} */
module.exports = {
  // Graph mode used by "depxray scan" when --mode is not passed.
  mode: 'dependencies',

  // Additional file or directory patterns to ignore.
  ignore: [],

  // File extensions included in dependency scans.
  extensions: ['.js', '.jsx', '.ts', '.tsx'],

  // Entry points excluded from orphan-file detection.
  entryPoints: [
    '**/index.*',
    '**/main.*',
    '**/app.*',
    '**/App.*',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.config.*',
  ],

  // Enable circular dependency detection.
  circular: true,

  // Resolve tsconfig.json and jsconfig.json path aliases.
  aliases: true,

  // Preferred local browser UI port.
  port: 5178,

  // Initial visible tree depth in the browser UI. Use "all" to expand everything.
  depth: 2,

  // Optional architecture rules for "depxray scan --validate".
  // Rules block imports from matching "from" files into matching "to" files.
  rules: [
    // {
    //   from: 'src/ui/**',
    //   to: 'src/db/**',
    //   severity: 'error',
    //   message: 'UI cannot import DB modules directly',
    // },
  ],

  // Optional plugins. Use built-in aliases or relative module paths.
  plugins: [
    // '@depxray/plugin-complexity',
    // '@depxray/plugin-mcp',
    // './depxray-plugin.mjs',
  ],
};
`;

export async function createConfigFile(
  rootDir: string,
  options: InitCommandOptions = {},
): Promise<string> {
  const configPath = path.join(path.resolve(rootDir), 'depxray.config.js');

  try {
    await fs.access(configPath);
    if (!options.force) {
      throw new Error(`Config already exists: ${configPath}. Use --force to overwrite it.`);
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, DEFAULT_CONFIG, 'utf-8');
  return configPath;
}

export function createInitCommand(): Command {
  return new Command('init')
    .description('Create a depxray.config.js file with sensible defaults')
    .argument('[dir]', 'Project directory for the config file (default: current directory)', '.')
    .option('--defaults', 'Create the default config without prompts')
    .option('--force', 'Overwrite an existing depxray.config.js')
    .action(async (dir: string, options: InitCommandOptions) => {
      try {
        const configPath = await createConfigFile(dir, options);
        process.stderr.write(`Created ${configPath}\n`);
      } catch (err) {
        console.error(`Init failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
