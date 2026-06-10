# @depxray/mcp

MCP server for depxray dependency analysis and AI-agent codebase context.

## Usage

```bash
npx @depxray/mcp
```

The server communicates over stdio and exposes tools for scanning project structure, dependency graphs, circular dependencies, orphan files, file inspection, and folder summaries.

It is designed for MCP-compatible coding agents that need repository context before editing code.

## Claude Desktop

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

## Cursor

Add a new MCP server with:

```json
{
  "command": "npx",
  "args": ["@depxray/mcp"]
}
```

## Tools

- `scan_project`: return structure or dependency graph data.
  Input: `{ "rootDir": "/path/to/project", "mode": "dependencies" }`
- `inspect_file`: inspect a file's imports and dependents.
  Input: `{ "rootDir": "/path/to/project", "filePath": "src/App.tsx" }`
- `find_circular`: list circular dependency chains.
  Input: `{ "rootDir": "/path/to/project" }`
- `find_orphans`: list orphan files.
  Input: `{ "rootDir": "/path/to/project" }`
- `get_file_tree`: return a project file tree.
  Input: `{ "rootDir": "/path/to/project", "maxDepth": 3 }`
- `get_folder_summary`: return folder-level dependency metrics.
  Input: `{ "rootDir": "/path/to/project", "folderPath": "src/components" }`

`scan_project` supports `mode: "dependencies"` and `mode: "structure"`. Dependency mode returns imports, circular counts, orphan files, and graph edges. Structure mode returns directory and file parent-child graph data.
