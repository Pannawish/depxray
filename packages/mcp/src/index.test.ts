import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createDepxrayMcpServer } from './index.js';

describe('Depxray MCP server', () => {
  it('registers all public tools', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createDepxrayMcpServer();
    const client = new Client({
      name: 'depxray-test-client',
      version: '1.0.0',
    });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const result = await client.listTools();

      expect(result.tools.map((tool) => tool.name).sort()).toEqual([
        'analyze_impact',
        'check_health',
        'diff_graphs',
        'explain_dependency_chain',
        'find_circular',
        'find_orphans',
        'find_related_files',
        'find_unused_exports',
        'get_file_tree',
        'get_folder_summary',
        'inspect_file',
        'scan_project',
        'suggest_cleanup',
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
