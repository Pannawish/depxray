import { describe, it, expect } from 'vitest';
import { parseImports } from '../src/parseImports.js';

describe('parseImports', () => {
  // ─── Static imports ──────────────────────────────────────────────────

  it('should parse default import', () => {
    const code = `import React from 'react';`;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('react');
    expect(result[0].specifiers).toContain('React');
    expect(result[0].isTypeOnly).toBe(false);
    expect(result[0].isDynamic).toBe(false);
  });

  it('should parse named imports', () => {
    const code = `import { useState, useEffect } from 'react';`;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('react');
    expect(result[0].specifiers).toContain('useState');
    expect(result[0].specifiers).toContain('useEffect');
  });

  it('should parse namespace import', () => {
    const code = `import * as Utils from './utils';`;
    const result = parseImports(code, 'test.ts');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./utils');
    expect(result[0].specifiers).toContain('* as Utils');
  });

  it('should parse side-effect import', () => {
    const code = `import './styles.css';`;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./styles.css');
    expect(result[0].specifiers).toHaveLength(0);
  });

  it('should parse relative imports', () => {
    const code = `
      import { Button } from './components/Button';
      import { helper } from '../utils/helper';
    `;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('./components/Button');
    expect(result[1].source).toBe('../utils/helper');
  });

  it('should parse alias imports', () => {
    const code = `import { Button } from '@/components/Button';`;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('@/components/Button');
  });

  // ─── Type-only imports ───────────────────────────────────────────────

  it('should detect type-only imports', () => {
    const code = `import type { Props } from './types';`;
    const result = parseImports(code, 'test.ts');

    expect(result).toHaveLength(1);
    expect(result[0].isTypeOnly).toBe(true);
    expect(result[0].source).toBe('./types');
  });

  // ─── Re-exports ─────────────────────────────────────────────────────

  it('should parse named re-exports', () => {
    const code = `export { Button } from './Button';`;
    const result = parseImports(code, 'index.ts');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./Button');
    expect(result[0].specifiers).toContain('Button');
  });

  it('should parse barrel re-exports (export *)', () => {
    const code = `export * from './utils';`;
    const result = parseImports(code, 'index.ts');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./utils');
    expect(result[0].specifiers).toContain('*');
  });

  // ─── Dynamic imports ────────────────────────────────────────────────

  it('should parse dynamic imports', () => {
    const code = `const LazyComponent = React.lazy(() => import('./LazyComponent'));`;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./LazyComponent');
    expect(result[0].isDynamic).toBe(true);
  });

  // ─── CommonJS require ──────────────────────────────────────────────

  it('should parse require() calls', () => {
    const code = `const fs = require('fs');`;
    const result = parseImports(code, 'test.js');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('fs');
  });

  it('should parse relative require() calls', () => {
    const code = `const helper = require('./helper');`;
    const result = parseImports(code, 'test.js');

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./helper');
  });

  // ─── Multiple imports ──────────────────────────────────────────────

  it('should parse multiple import styles in one file', () => {
    const code = `
      import React from 'react';
      import { useState } from 'react';
      import { Button } from './components/Button';
      import type { Props } from './types';
      export { Header } from './Header';
      export * from './utils';
      const Lazy = React.lazy(() => import('./Lazy'));
    `;
    const result = parseImports(code, 'test.tsx');

    // 7 import statements total
    expect(result).toHaveLength(7);

    const sources = result.map((r) => r.source);
    expect(sources).toContain('react');
    expect(sources).toContain('./components/Button');
    expect(sources).toContain('./types');
    expect(sources).toContain('./Header');
    expect(sources).toContain('./utils');
    expect(sources).toContain('./Lazy');
  });

  // ─── TypeScript-specific ───────────────────────────────────────────

  it('should handle TypeScript files with generics and interfaces', () => {
    const code = `
      import { useState } from 'react';
      import type { FC } from 'react';

      interface Props {
        items: Array<string>;
      }

      const Component: FC<Props> = ({ items }) => {
        const [count, setCount] = useState<number>(0);
        return <div>{count}</div>;
      };
    `;
    const result = parseImports(code, 'test.tsx');

    expect(result).toHaveLength(2);
    expect(result[0].isTypeOnly).toBe(false);
    expect(result[1].isTypeOnly).toBe(true);
  });

  it('should handle JSX in .tsx files', () => {
    const code = `
      import React from 'react';
      export default function App() {
        return <div className="app"><span>Hello</span></div>;
      }
    `;
    // Should not throw
    const result = parseImports(code, 'App.tsx');
    expect(result).toHaveLength(1);
  });

  it('should handle decorators', () => {
    const code = `
      import { Component } from './decorators';

      @Component
      class MyClass {}
    `;
    const result = parseImports(code, 'test.ts');
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('./decorators');
  });

  // ─── Edge cases ─────────────────────────────────────────────────────

  it('should throw on unparseable files', () => {
    const code = `this is not valid javascript {{{}}}`;
    expect(() => parseImports(code, 'bad.ts')).toThrow();
  });

  it('should return empty array for files with no imports', () => {
    const code = `
      export const x = 42;
      export function hello() { return 'world'; }
    `;
    const result = parseImports(code, 'test.ts');
    expect(result).toHaveLength(0);
  });

  it('should capture line numbers', () => {
    const code = `import { A } from './a';\nimport { B } from './b';`;
    const result = parseImports(code, 'test.ts');

    expect(result[0].line).toBe(1);
    expect(result[1].line).toBe(2);
  });
});
