import React from 'react';
import type { GraphNode } from '../hooks/useVSCodeAPI.js';

interface LegendProps {
  circularCount: number;
}

const items = [
  { color: '#61DAFB', label: '.tsx — React component' },
  { color: '#3178C6', label: '.ts — TypeScript' },
  { color: '#F7DF1E', label: '.js / .jsx — JavaScript' },
  { color: '#FF5555', label: 'Circular dependency' },
];

export function Legend({ circularCount }: LegendProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      background: 'var(--vscode-sideBar-background, rgba(30,30,30,0.9))',
      border: '1px solid var(--vscode-panel-border, #444)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 11,
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: item.color,
            flexShrink: 0,
          }} />
          <span style={{ color: 'var(--vscode-editor-foreground, #ccc)', opacity: 0.8 }}>
            {item.label}
          </span>
        </div>
      ))}
      {circularCount > 0 && (
        <div style={{ marginTop: 6, color: '#FF5555', fontWeight: 600 }}>
          ⚠ {circularCount} circular chain{circularCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
