#!/usr/bin/env node
// ============================================================================
// React Dependency Graph — CLI Entry Point
// ============================================================================
//
// Commands:
//   scan [dir]           Scan a React project and open its structure graph
//   inspect <file>       Inspect a single file's dependencies
//
// Usage:
//   npx react-dependency-graph scan                         # Open local browser UI
//   npx react-dependency-graph scan ./my-app                # Scan specific dir
//   npx react-dependency-graph scan --json                  # Print structure JSON
//   npx react-dependency-graph scan --json --output graph.json
//   npx react-dependency-graph scan --html                  # Static HTML export
//   npx react-dependency-graph scan --mode dependencies     # Import graph mode
//   npx react-dependency-graph scan --port 5180             # Custom server port
//   npx react-dependency-graph inspect src/App.tsx           # Inspect one file
//
// Short alias:
//   npx rdg scan
//   npx rdg inspect src/App.tsx
//
// For AI agents:
//   npx rdg scan --json > structure.json
//   npx rdg inspect src/App.tsx --format json
//
// ============================================================================

import { Command } from 'commander';
import { createScanCommand } from './commands/scan.js';
import { createInspectCommand } from './commands/inspect.js';

const program = new Command();

program
  .name('react-dependency-graph')
  .description(
    'Scan React projects and generate structure or dependency graphs.\n\n' +
      'Useful for understanding project structure in the browser, with the legacy inspect command\n' +
      'and providing structured data to AI coding agents (Claude, Codex, Antigravity).',
  )
  .version('0.3.0');

// Register commands
program.addCommand(createScanCommand());
program.addCommand(createInspectCommand());

// Parse and execute
program.parse();
