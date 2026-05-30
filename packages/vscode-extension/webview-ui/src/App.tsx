// ============================================================================
// App — Root component of the webview React app
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { DependencyGraph } from './components/DependencyGraph.js';
import { Toolbar } from './components/Toolbar.js';
import { Legend } from './components/Legend.js';
import { useVSCodeAPI } from './hooks/useVSCodeAPI.js';
import type { ScanResult } from './hooks/useVSCodeAPI.js';

export default function App() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [layout, setLayout] = useState<'LR' | 'TB'>('LR');
  const [statusMsg, setStatusMsg] = useState('Waiting for scan data…');

  const { postMessage } = useVSCodeAPI(useCallback((msg) => {
    switch (msg.type) {
      case 'graphData':
        setScanResult(msg.data);
        setIsScanning(false);
        setStatusMsg('');
        break;
      case 'scanProgress':
        setIsScanning(true);
        setStatusMsg(msg.message);
        break;
      case 'error':
        setIsScanning(false);
        setStatusMsg(`Error: ${msg.message}`);
        break;
      case 'theme':
        setIsDark(msg.isDark);
        break;
    }
  }, []));

  // Tell the extension we are ready to receive data
  useEffect(() => {
    postMessage({ type: 'ready' });
  }, [postMessage]);

  const handleScan = useCallback(() => {
    setIsScanning(true);
    postMessage({ type: 'requestScan' });
  }, [postMessage]);

  const handleExport = useCallback(() => {
    postMessage({ type: 'exportGraph' });
  }, [postMessage]);

  const handleNodeClick = useCallback((absolutePath: string) => {
    postMessage({ type: 'openFile', filePath: absolutePath });
  }, [postMessage]);

  // Loading / empty state
  if (!scanResult) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--vscode-descriptionForeground, #888)',
        gap: 12,
      }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: 14 }}>
          {isScanning ? '⟳ Scanning project…' : statusMsg}
        </div>
        {!isScanning && (
          <button
            onClick={handleScan}
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #fff)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Scan Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        totalFiles={scanResult.totalFiles}
        totalImports={scanResult.totalImports}
        circularCount={scanResult.circularCount}
        durationMs={scanResult.durationMs}
        isScanning={isScanning}
        onScan={handleScan}
        onExport={handleExport}
        onLayoutChange={setLayout}
        layout={layout}
      />
      <div style={{ flex: 1, marginTop: 44 }}>
        <DependencyGraph
          scanResult={scanResult}
          layout={layout}
          isDark={isDark}
          onNodeClick={handleNodeClick}
        />
      </div>
      <Legend circularCount={scanResult.circularCount} />
    </div>
  );
}
