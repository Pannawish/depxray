// B imports A, completing the circular dependency
import { getA } from './moduleA';

export function getB(): string {
  return 'B-' + getA();
}
