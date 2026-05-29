// D imports E
import { getE } from './moduleE';

export function getD(): string {
  return 'D-' + getE();
}
