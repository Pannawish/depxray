import { useEffect, useState } from 'react';
import * as graphContract from '@depxray/core/graph-contract';
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
  graphSet: unknown;
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

function isLiveGraphSetMessage(value: unknown): value is LiveGraphSetMessage {
  return (
    typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === 'graph-set'
    && 'graphSet' in value
  );
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
          const message: unknown = JSON.parse(event.data as string);
          if (!isLiveGraphSetMessage(message) || cancelled) {
            return;
          }
          graphContract.assertExplorerGraphSet(message.graphSet);

          setState({
            dataSet: message.graphSet,
            loading: false,
            error: null,
            source: 'live',
          });
        } catch (error) {
          if (!cancelled) {
            setState((current) => ({
              ...current,
              error: error instanceof Error
                ? `Ignored invalid live data: ${error.message}`
                : 'Ignored invalid live data.',
            }));
          }
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
      try {
        if (window.__GRAPH_DATA_SET__) {
          graphContract.assertExplorerGraphSet(window.__GRAPH_DATA_SET__);
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
          graphContract.assertExplorerGraphData(window.__GRAPH_DATA__);
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

        const response = await fetch('/api/graph-set');
        if (!response.ok) {
          const legacyResponse = await fetch('/api/graph-data');
          if (!legacyResponse.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const legacyData: unknown = await legacyResponse.json();
          graphContract.assertExplorerGraphData(legacyData);
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

        const data: unknown = await response.json();
        graphContract.assertExplorerGraphSet(data);
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
