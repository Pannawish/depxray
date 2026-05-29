#!/usr/bin/env node
// ============================================================================
// React Dependency Graph — CLI Entry Point
// ============================================================================
//
// Commands:
//   scan [dir]           Scan a React project and output its dependency graph
//   inspect <file>       Inspect a single file's dependencies
//
// Usage:
//   npx react-dependency-graph scan                         # Scan current dir (JSON)
//   npx react-dependency-graph scan ./my-app                # Scan specific dir
//   npx react-dependency-graph scan --format json           # JSON output (default)
//   npx react-dependency-graph scan --format text           # Human-readable summary
//   npx react-dependency-graph scan --format dot            # Graphviz DOT format
//   npx react-dependency-graph scan --output graph.json     # Write to file
//   npx react-dependency-graph scan --ignore __tests__ e2e  # Extra ignore patterns
//   npx react-dependency-graph inspect src/App.tsx           # Inspect one file
//
// Short alias:
//   npx rdg scan
//   npx rdg inspect src/App.tsx
//
// Piping to Graphviz:
//   npx rdg scan --format dot | dot -Tsvg -o graph.svg
//   npx rdg scan --format dot | dot -Tpng -o graph.png
//
// For AI agents:
//   npx rdg scan --format json > deps.json
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
    'Scan React projects and generate dependency graphs.\n\n' +
      'Useful for understanding project structure, detecting circular dependencies,\n' +
      'and providing structured data to AI coding agents (Claude, Codex, Antigravity).',
  )
  .version('0.2.0');

// Register commands
program.addCommand(createScanCommand());
program.addCommand(createInspectCommand());

// Parse and execute
program.parse();
