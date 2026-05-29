// E imports C, completing a 3-node cycle: C → D → E → C
import { getC } from './moduleC';

export function getE(): string {
  return 'E-' + getC();
}
