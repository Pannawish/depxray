// ============================================================================
// depxray — CLI Entry Point
// ============================================================================
//
// Commands:
//   scan [dir]           Scan a project and open its structure graph
//   inspect <file>       Inspect a single file's dependencies
//
// Usage:
//   npx depxray scan                         # Open local browser UI
//   npx depxray scan ./my-app                # Scan specific dir
//   npx depxray scan --json                  # Print structure JSON
//   npx depxray scan --json --output graph.json
//   npx depxray scan --html                  # Static HTML export
//   npx depxray scan --mode dependencies     # Import graph mode
//   npx depxray scan --port 5180             # Custom server port
//   npx depxray inspect src/App.tsx          # Inspect one file
//
// For AI agents:
//   npx depxray scan --json > structure.json
//   npx depxray inspect src/App.tsx --format json
//
// ============================================================================

import { Command } from 'commander';
import { createScanCommand } from './commands/scan.js';
import { createInspectCommand } from './commands/inspect.js';

const program = new Command();

program
  .name('depxray')
  .description(
    'Scan projects and generate structure or dependency graphs.\n\n' +
      'Useful for understanding project structure in the browser, with the legacy inspect command\n' +
      'and providing structured data to AI coding agents (Claude, Codex, Antigravity).',
  )
  .version('0.3.1');

// Register commands
program.addCommand(createScanCommand());
program.addCommand(createInspectCommand());

// Parse and execute
program.parse();
