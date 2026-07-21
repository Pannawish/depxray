import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createDepxrayMcpServer } from './index.js';

const SIMPLE_PROJECT = path.resolve(__dirname, '../../core/__tests__/fixtures/simple-project');

describe('MCP protocol', () => {
  const server = createDepxrayMcpServer();
  const client = new Client({ name: 'depxray-e2e-test', version: '1.0.0' });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('negotiates capabilities and invokes a real scan tool', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['scan_project', 'inspect_file', 'suggest_cleanup']),
    );

    const response = await client.callTool({
      name: 'scan_project',
      arguments: {
        rootDir: SIMPLE_PROJECT,
        mode: 'dependencies',
      },
    });
    expect(response.isError).not.toBe(true);

    const textContent = response.content.find((item) => item.type === 'text');
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') {
      throw new Error('scan_project did not return MCP text content.');
    }

    expect(JSON.parse(textContent.text)).toMatchObject({
      mode: 'dependencies',
      schemaVersion: '1.0.0',
      totalFiles: expect.any(Number),
    });
  });
});
