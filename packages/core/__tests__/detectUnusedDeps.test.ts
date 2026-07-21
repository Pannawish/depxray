import { describe, expect, it } from 'vitest';
import { detectUnusedDeps } from '../src/detectUnusedDeps.js';

describe('detectUnusedDeps', () => {
  it('reports unused and unlisted package dependencies', () => {
    const result = detectUnusedDeps(
      '/project',
      [
        { importSpecifier: 'react' },
        { importSpecifier: 'lodash/debounce' },
        { importSpecifier: 'missing-package/subpath' },
        { importSpecifier: './local' },
      ],
      {
        dependencies: {
          react: '^18.0.0',
          lodash: '^4.17.21',
          unused: '^1.0.0',
        },
      },
    );

    expect(result).toEqual({
      unused: ['unused'],
      unlisted: ['missing-package'],
    });
  });

  it('handles scoped packages and ignores Node.js built-ins', () => {
    const result = detectUnusedDeps(
      '/project',
      [
        { importSpecifier: '@scope/pkg/submodule' },
        { importSpecifier: 'node:path' },
        { importSpecifier: 'fs/promises' },
      ],
      {
        dependencies: {
          '@scope/pkg': '^1.0.0',
          '@scope/unused': '^1.0.0',
        },
      },
    );

    expect(result).toEqual({
      unused: ['@scope/unused'],
      unlisted: [],
    });
  });

  it('ignores package self imports', () => {
    const result = detectUnusedDeps('/project', [{ importSpecifier: 'my-package/utils' }], {
      name: 'my-package',
      dependencies: {},
    });

    expect(result).toEqual({
      unused: [],
      unlisted: [],
    });
  });
});
