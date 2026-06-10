import { describe, expect, it } from 'vitest';
import { computeFileMetrics } from '../src/computeMetrics.js';

describe('computeFileMetrics', () => {
  it('counts lines of code and exports', () => {
    const result = computeFileMetrics(
      `
export const one = 1;
export function two() {
  return one + 1;
}
export { one as renamed };
`,
      '/project/src/file.ts',
    );

    expect(result.loc).toBe(5);
    expect(result.exportCount).toBe(3);
  });

  it('counts cyclomatic complexity decision points', () => {
    const result = computeFileMetrics(
      `
export function score(value: number, fallback?: number) {
  if (value > 10 && fallback) {
    return value;
  } else if (value > 5 || fallback) {
    return fallback ?? value;
  }

  for (const item of [1, 2, 3]) {
    switch (item) {
      case 1:
        break;
      case 2:
        break;
      default:
        break;
    }
  }

  try {
    return value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
`,
      '/project/src/file.ts',
    );

    expect(result.cyclomaticComplexity).toBe(11);
  });

  it('parses JSX and TypeScript syntax', () => {
    const result = computeFileMetrics(
      `
type Props = { ready?: boolean };
export default function View(props: Props) {
  return props.ready ? <div>Ready</div> : null;
}
`,
      '/project/src/View.tsx',
    );

    expect(result.exportCount).toBe(1);
    expect(result.cyclomaticComplexity).toBe(2);
  });
});
