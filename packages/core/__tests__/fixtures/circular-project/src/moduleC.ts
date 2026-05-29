// C imports D
import { getD } from './moduleD';

export function getC(): string {
  return 'C-' + getD();
}
