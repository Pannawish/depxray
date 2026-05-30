import { useMemo } from 'react';
import { buildRelationshipIndex } from '../relationshipIndex.js';
import type { ExplorerGraphSet } from '../types.js';

export function useRelationshipIndex(dataSet: ExplorerGraphSet | null) {
  return useMemo(() => buildRelationshipIndex(dataSet), [dataSet]);
}
