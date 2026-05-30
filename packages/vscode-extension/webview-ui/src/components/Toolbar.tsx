import React from 'react';

interface ToolbarProps {
  totalFiles: number;
  totalImports: number;
  circularCount: number;
  durationMs: number;
  isScanning: boolean;
  onScan: () => void;
  onExport: () => void;
  onLayoutChange: (dir: 'LR' | 'TB') => void;
  layout: 'LR' | 'TB';
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid var(--vscode-button-border, transparent)',
  background: 'var(--vscode-button-secondaryBackground, #3a3a3a)',
  color: 'var(--vscode-button-secondaryForeground, #ccc)',
  cursor: 'pointer',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--vscode-button-background, #0e639c)',
  color: 'var(--vscode-button-foreground, #fff)',
};

export function Toolbar({
  totalFiles,
  totalImports,
  circularCount,
  durationMs,
  isScanning,
  onScan,
  onExport,
  onLayoutChange,
  layout,
}: ToolbarProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px',
      background: 'var(--vscode-titleBar-activeBackground, #1e1e1e)',
      borderBottom: '1px solid var(--vscode-panel-border, #333)',
      zIndex: 10,
    }}>
      {/* Title */}
      <span style={{
        fontWeight: 600,
        fontSize: 13,
        color: 'var(--vscode-titleBar-activeForeground, #ccc)',
        marginRight: 4,
      }}>
        React Dependency Graph
      </span>

      {/* Stats */}
      {totalFiles > 0 && (
        <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground, #888)', marginRight: 8 }}>
          {totalFiles} files · {totalImports} imports
          {circularCount > 0 && (
            <span style={{ color: '#FF5555', marginLeft: 6 }}>· ⚠ {circularCount} circular</span>
          )}
          <span style={{ marginLeft: 6, opacity: 0.6 }}>({durationMs.toFixed(0)}ms)</span>
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Layout toggle */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          style={{ ...btnStyle, borderRadius: '4px 0 0 4px', background: layout === 'LR' ? 'var(--vscode-button-background, #0e639c)' : undefined }}
          onClick={() => onLayoutChange('LR')}
          title="Left-to-right layout"
        >
          ↔ LR
        </button>
        <button
          style={{ ...btnStyle, borderRadius: '0 4px 4px 0', background: layout === 'TB' ? 'var(--vscode-button-background, #0e639c)' : undefined }}
          onClick={() => onLayoutChange('TB')}
          title="Top-to-bottom layout"
        >
          ↕ TB
        </button>
      </div>

      {/* Export */}
      <button style={btnStyle} onClick={onExport} title="Export graph as JSON">
        ↓ Export JSON
      </button>

      {/* Re-scan */}
      <button
        style={primaryBtnStyle}
        onClick={onScan}
        disabled={isScanning}
        title="Re-scan project"
      >
        {isScanning ? '⟳ Scanning…' : '⟳ Re-scan'}
      </button>
    </div>
  );
}
