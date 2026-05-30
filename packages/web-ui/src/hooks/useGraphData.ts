import { useEffect, useState } from 'react';
import { sampleGraphData } from '../mockData.js';
import type { StructureGraphData } from '../types.js';

interface GraphDataState {
  data: StructureGraphData | null;
  loading: boolean;
  error: string | null;
  source: 'window' | 'http' | 'sample';
}

export function useGraphData(): GraphDataState {
  const [state, setState] = useState<GraphDataState>({
    data: null,
    loading: true,
    error: null,
    source: 'sample',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadGraphData() {
      if (window.__GRAPH_DATA__) {
        if (!cancelled) {
          setState({
            data: window.__GRAPH_DATA__,
            loading: false,
            error: null,
            source: 'window',
          });
        }
        return;
      }

      try {
        const response = await fetch('/api/graph-data');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json() as StructureGraphData;
        if (!cancelled) {
          setState({
            data,
            loading: false,
            error: null,
            source: 'http',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            data: sampleGraphData,
            loading: false,
            error: (err as Error).message,
            source: 'sample',
          });
        }
      }
    }

    void loadGraphData();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
