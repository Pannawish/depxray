import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  createWatchScheduler,
  listenOnAvailablePort,
  mergeScanOptionsWithConfig,
  parsePort,
} from '../src/commands/scan';

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

describe('scan config merging', () => {
  it('uses config values when CLI options were not provided', () => {
    const merged = mergeScanOptionsWithConfig(
      {
        mode: 'structure',
        depth: '2',
        port: '5178',
        circular: true,
        aliases: true,
      },
      {
        mode: 'dependencies',
        depth: 'all',
        port: 6000,
        circular: false,
        aliases: false,
        ignore: ['dist'],
        extensions: ['.ts'],
        entryPoints: ['src/main.ts'],
      },
      () => 'default',
    );

    expect(merged).toMatchObject({
      mode: 'dependencies',
      depth: 'all',
      port: '6000',
      circular: false,
      aliases: false,
      ignore: ['dist'],
      extensions: ['.ts'],
      entryPoints: ['src/main.ts'],
    });
  });

  it('keeps CLI values when provided', () => {
    const merged = mergeScanOptionsWithConfig(
      {
        mode: 'structure',
        depth: '4',
        port: '7000',
        circular: false,
      },
      {
        mode: 'dependencies',
        depth: 'all',
        port: 6000,
        circular: true,
      },
      (name) => (['mode', 'depth', 'port', 'circular'].includes(name) ? 'cli' : 'default'),
    );

    expect(merged).toMatchObject({
      mode: 'structure',
      depth: '4',
      port: '7000',
      circular: false,
    });
  });
});

describe('watch scheduling', () => {
  it('debounces rebuilds and uses the latest event', async () => {
    vi.useFakeTimers();
    const rebuild = vi.fn().mockResolvedValue(undefined);
    const schedule = createWatchScheduler(rebuild, 50);

    schedule('change', '/tmp/first.ts');
    schedule('change', '/tmp/second.ts');

    await vi.advanceTimersByTimeAsync(49);
    expect(rebuild).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(rebuild).toHaveBeenCalledWith('change', '/tmp/second.ts');
    vi.useRealTimers();
  });
});
