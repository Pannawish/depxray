// ============================================================================
// Status Bar — Persistent status bar item showing scan state
// ============================================================================

import * as vscode from 'vscode';
import type { ScanResult } from '@rdg/core';

export class RdgStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    // Right-side status bar, priority 100 keeps it stable
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = 'rdg.showGraph';
    this.item.tooltip = 'React Dependency Graph — click to open graph';
    this.setReady();
    this.item.show();
  }

  setReady(): void {
    this.item.text = '$(type-hierarchy) RDG';
    this.item.backgroundColor = undefined;
  }

  setScanning(): void {
    this.item.text = '$(loading~spin) RDG: Scanning…';
    this.item.backgroundColor = undefined;
  }

  setResult(result: ScanResult): void {
    const { totalFiles, totalImports, circularCount } = result;

    if (circularCount > 0) {
      this.item.text = `$(warning) RDG: ${totalFiles} files · ${circularCount} circular`;
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground',
      );
    } else {
      this.item.text = `$(type-hierarchy) RDG: ${totalFiles} files · ${totalImports} imports`;
      this.item.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
