// A imports B, which creates a circular dependency chain
import { getB } from './moduleB';

export function getA(): string {
  return 'A-' + getB();
}
