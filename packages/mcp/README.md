# @depxray/mcp

Give AI coding agents dependency-aware context before they edit your code.

`@depxray/mcp` is the Model Context Protocol server for depxray. It lets MCP-compatible clients such as Claude Desktop, Cursor, and other coding agents inspect JavaScript and TypeScript projects through static dependency analysis.

Use it when an agent needs to answer questions like:

- What does this file import?
- What files depend on this file?
- Are there circular dependencies?
- Which files appear to be orphaned?
- What is inside this folder?
- What does the project dependency graph look like?

The server runs locally over stdio and uses `@depxray/core`, the same scanner that powers the `depxray` CLI and browser UI.

## Quick Start

```bash
npx @depxray/mcp
```

Most users do not run this command directly. Add it to your MCP client configuration so the client can start the server when needed.

## Why Use This

- Help coding agents understand a repository before making edits
- Inspect imports and dependents for a target file
- Find circular dependencies before refactors
- Find orphan files that may be safe cleanup candidates
- Summarize folder-level dependency relationships
- Produce machine-readable project structure and dependency graph context

`@depxray/mcp` is especially useful for agentic coding workflows where the agent should inspect dependency impact before changing source files.

## Claude Desktop Setup

Add this to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "depxray": {
      "command": "npx",
      "args": ["@depxray/mcp"]
    }
  }
}
```

## Cursor Setup

Add a new MCP server with:

```json
{
  "command": "npx",
  "args": ["@depxray/mcp"]
}
```

## Agent Workflow Example

A coding agent can use the tools in this order before editing:

1. Call `get_file_tree` to understand the project layout.
2. Call `inspect_file` for the file it plans to modify.
3. Call `get_folder_summary` for the surrounding folder.
4. Call `find_circular` or `find_orphans` when planning a refactor.
5. Call `scan_project` when it needs full graph context.

This gives the agent a clearer view of dependency impact before it changes code.

## Tools

| Tool | Use When | Example Input |
| --- | --- | --- |
| `scan_project` | The agent needs full structure or dependency graph data. | `{ "rootDir": "/path/to/project", "mode": "dependencies" }` |
| `inspect_file` | The agent needs imports, dependents, and metrics for one file. | `{ "rootDir": "/path/to/project", "filePath": "src/App.tsx" }` |
| `find_circular` | The agent should detect dependency cycles before a refactor. | `{ "rootDir": "/path/to/project" }` |
| `find_orphans` | The agent should find files with no incoming references. | `{ "rootDir": "/path/to/project" }` |
| `get_file_tree` | The agent needs a compact project tree. | `{ "rootDir": "/path/to/project", "maxDepth": 3 }` |
| `get_folder_summary` | The agent needs folder-level dependency metrics. | `{ "rootDir": "/path/to/project", "folderPath": "src/components" }` |

`scan_project` supports `mode: "dependencies"` and `mode: "structure"`. Dependency mode returns imports, circular counts, orphan files, and graph edges. Structure mode returns directory and file parent-child graph data.

## Supported Projects

`@depxray/mcp` analyzes JavaScript and TypeScript projects with:

- `.js`, `.jsx`, `.ts`, and `.tsx` files
- static imports
- type-only imports
- dynamic imports
- CommonJS `require`
- re-exports and barrel files
- `tsconfig.json` and `jsconfig.json` path aliases

## Privacy

The MCP server runs locally and performs static analysis on files in the project paths provided by the MCP client. It does not send your source code to depxray or any external depxray service.

Your MCP client may still send tool results to its own model provider. Review your client configuration and provider policy if you are working with private code.

## Relationship To `depxray`

This package is the MCP interface for depxray.

- Use `npx depxray scan` for the browser UI, CLI JSON output, and static HTML reports.
- Use `npx @depxray/mcp` when an MCP-compatible AI coding agent needs depxray tools.
