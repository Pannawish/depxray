import { useEffect, useState } from 'react';
import { sampleGraphData, sampleGraphSet } from '../mockData.js';
import type { ExplorerGraphData, ExplorerGraphSet } from '../types.js';

interface GraphDataState {
  dataSet: ExplorerGraphSet | null;
  loading: boolean;
  error: string | null;
  source: 'window' | 'http' | 'live' | 'sample';
}

interface LiveGraphSetMessage {
  type: 'graph-set';
  graphSet: ExplorerGraphSet;
}

function toGraphSet(data: ExplorerGraphData): ExplorerGraphSet {
  return {
    schemaVersion: data.schemaVersion,
    generatedBy: data.generatedBy,
    projectRoot: data.projectRoot,
    scannedAt: data.scannedAt,
    availableModes: [data.mode],
    defaultMode: data.mode,
    graphs: {
      [data.mode]: data,
    },
  };
}

export function useGraphData(): GraphDataState {
  const [state, setState] = useState<GraphDataState>({
    dataSet: null,
    loading: true,
    error: null,
    source: 'sample',
  });

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    function connectLiveUpdates() {
      if (window.__GRAPH_DATA_SET__ || window.__GRAPH_DATA__) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/api/live`);

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data as string) as LiveGraphSetMessage;
          if (message.type !== 'graph-set' || cancelled) {
            return;
          }

          setState({
            dataSet: message.graphSet,
            loading: false,
            error: null,
            source: 'live',
          });
        } catch {
          // Ignore malformed live messages; the last valid graph remains visible.
        }
      });

      socket.addEventListener('error', () => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error: current.error ?? 'Live updates are unavailable.',
          }));
        }
      });
    }

    async function loadGraphData() {
      if (window.__GRAPH_DATA_SET__) {
        if (!cancelled) {
          setState({
            dataSet: window.__GRAPH_DATA_SET__,
            loading: false,
            error: null,
            source: 'window',
          });
        }
        return;
      }

      if (window.__GRAPH_DATA__) {
        if (!cancelled) {
          setState({
            dataSet: toGraphSet(window.__GRAPH_DATA__),
            loading: false,
            error: null,
            source: 'window',
          });
        }
        return;
      }

      try {
        const response = await fetch('/api/graph-set');
        if (!response.ok) {
          const legacyResponse = await fetch('/api/graph-data');
          if (!legacyResponse.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const legacyData = await legacyResponse.json() as ExplorerGraphData;
          if (!cancelled) {
            setState({
              dataSet: toGraphSet(legacyData),
              loading: false,
              error: null,
              source: 'http',
            });
            connectLiveUpdates();
          }
          return;
        }

        const data = await response.json() as ExplorerGraphSet;
        if (!cancelled) {
          setState({
            dataSet: data,
            loading: false,
            error: null,
            source: 'http',
          });
          connectLiveUpdates();
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            dataSet: sampleGraphSet,
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
      socket?.close();
    };
  }, []);

  return state;
}
