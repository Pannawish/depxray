import { describe, expect, it } from 'vitest';
import { interpolateHeatColor } from './graphColors.js';

describe('graph heatmap colors', () => {
  it('interpolates low, middle, and high metric values', () => {
    expect(interpolateHeatColor(0, 10)).toBe('rgb(21,128,61)');
    expect(interpolateHeatColor(5, 10)).toBe('rgb(180,83,9)');
    expect(interpolateHeatColor(10, 10)).toBe('rgb(179,58,50)');
    expect(interpolateHeatColor(20, 10)).toBe('rgb(179,58,50)');
  });

  it('uses the low color when there is no maximum value', () => {
    expect(interpolateHeatColor(5, 0)).toBe('rgb(21,128,61)');
  });
});
