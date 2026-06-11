export type GraphColorMode = 'extension' | 'complexity' | 'size' | 'instability';

export function interpolateHeatColor(value: number, max: number): string {
  const t = max > 0 ? Math.min(value / max, 1) : 0;
  if (t < 0.5) {
    const ratio = t * 2;
    const r = Math.round(21 + (180 - 21) * ratio);
    const g = Math.round(128 + (83 - 128) * ratio);
    const b = Math.round(61 + (9 - 61) * ratio);
    return `rgb(${r},${g},${b})`;
  }

  const ratio = (t - 0.5) * 2;
  const r = Math.round(180 + (179 - 180) * ratio);
  const g = Math.round(83 + (58 - 83) * ratio);
  const b = Math.round(9 + (50 - 9) * ratio);
  return `rgb(${r},${g},${b})`;
}
