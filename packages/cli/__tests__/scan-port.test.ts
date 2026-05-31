import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import { describe, expect, it } from 'vitest';
import { listenOnAvailablePort, parsePort } from '../src/commands/scan';

class FakeServer extends EventEmitter {
  private readonly occupiedPorts: Set<number>;

  constructor(occupiedPorts: number[] = []) {
    super();
    this.occupiedPorts = new Set(occupiedPorts);
  }

  listen(port: number, _host: string): this {
    queueMicrotask(() => {
      if (this.occupiedPorts.has(port)) {
        const error = new Error('Address in use') as NodeJS.ErrnoException;
        error.code = 'EADDRINUSE';
        this.emit('error', error);
        return;
      }

      this.emit('listening');
    });

    return this;
  }
}

describe('scan port handling', () => {
  it('parses the default port', () => {
    expect(parsePort(undefined)).toBe(5178);
  });

  it('falls back to the next port when the requested port is busy', async () => {
    const server = new FakeServer([5178]);

    await expect(
      listenOnAvailablePort(server as unknown as http.Server, 5178, '127.0.0.1', 3),
    ).resolves.toBe(5179);
  });

  it('fails clearly when no spare port is available in the search range', async () => {
    const server = new FakeServer([5178, 5179, 5180]);

    await expect(
      listenOnAvailablePort(server as unknown as http.Server, 5178, '127.0.0.1', 3),
    ).rejects.toThrow(new Error('No available port found between 5178 and 5180.'));
  });
});
