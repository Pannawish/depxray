// ============================================================================
// useVSCodeAPI — Bridge between the React app and the VS Code extension host
// ============================================================================
// acquireVsCodeApi() is a global function injected by VS Code into the
// webview. It returns an API object with postMessage() and getState().
// We call it once and cache it — calling it again throws an error.
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';

// Shared types (copied here to avoid dependency on @rdg/core in the webview)
export interface GraphNode {
  id: string;
  relativePath: string;
  extension: string;
  inDegree: number;
  outDegree: number;
  isCircular: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  importSpecifier: string;
  importedNames: string[];
  isTypeOnly: boolean;
  isDynamic: boolean;
}

export interface ScanResult {
  totalFiles: number;
  totalImports: number;
  circularCount: number;
  durationMs: number;
  errors: Array<{ filePath: string; error: string }>;
  graph: {
    rootDir: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    circularDependencies: Array<{ chain: string[]; description: string }>;
    metadata: {
      scannedAt: string;
      scanDurationMs: number;
      projectRoot: string;
      totalFiles: number;
      totalEdges: number;
      circularCount: number;
      rdgVersion: string;
    };
  };
}

// Extension → Webview messages
export type ExtensionMessage =
  | { type: 'graphData'; data: ScanResult }
  | { type: 'scanProgress'; message: string }
  | { type: 'error'; message: string }
  | { type: 'theme'; isDark: boolean };

// Webview → Extension messages
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'openFile'; filePath: string; line?: number }
  | { type: 'requestScan' }
  | { type: 'exportGraph' };

// Cache the VS Code API object — can only be acquired once
let _vscodeApi: { postMessage: (msg: WebviewMessage) => void } | null = null;

function getVSCodeAPI() {
  if (!_vscodeApi) {
    // In the actual VS Code webview environment
    if (typeof (window as any).acquireVsCodeApi === 'function') {
      _vscodeApi = (window as any).acquireVsCodeApi();
    } else {
      // Fallback for local development (outside VS Code)
      _vscodeApi = {
        postMessage: (msg) => console.log('[vscode mock] postMessage:', msg),
      };
    }
  }
  return _vscodeApi!;
}

/**
 * Hook that provides a typed postMessage function and allows subscribing
 * to messages from the extension host.
 */
export function useVSCodeAPI(
  onMessage: (message: ExtensionMessage) => void,
): { postMessage: (msg: WebviewMessage) => void } {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      onMessageRef.current(event.data as ExtensionMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const postMessage = useCallback((msg: WebviewMessage) => {
    getVSCodeAPI().postMessage(msg);
  }, []);

  return { postMessage };
}
