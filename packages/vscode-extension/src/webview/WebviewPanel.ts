// ============================================================================
// WebviewPanel — Create and manage the dependency graph webview panel
// ============================================================================

import * as vscode from 'vscode';
import type { ScanResult } from '@rdg/core';
import { getWebviewContent } from './getWebviewContent.js';
import { openFile } from '../utils/openFile.js';
import { exportGraphJSON } from '@rdg/core';
import type { ScanManager } from '../ScanManager.js';

// Message types from webview → extension
type WebviewMessage =
  | { type: 'ready' }
  | { type: 'openFile'; filePath: string; line?: number }
  | { type: 'requestScan' }
  | { type: 'exportGraph' };

// Message types from extension → webview
export type ExtensionMessage =
  | { type: 'graphData'; data: ScanResult }
  | { type: 'scanProgress'; message: string }
  | { type: 'error'; message: string }
  | { type: 'theme'; isDark: boolean };

export class WebviewPanel {
  private static _instance: WebviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _isReady = false;
  private _pendingData: ScanResult | undefined;

  private constructor(
    extensionUri: vscode.Uri,
    private readonly scanManager: ScanManager,
    private readonly workspaceRoot: string,
  ) {
    this._panel = vscode.window.createWebviewPanel(
      'rdg.graphView',
      'Dependency Graph',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true, // Keep React state when panel is hidden
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
        ],
      },
    );

    // Set the webview HTML
    this._panel.webview.html = getWebviewContent(
      this._panel.webview,
      extensionUri,
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this._handleMessage(message),
      undefined,
      this._disposables,
    );

    // Clean up when panel is closed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Auto-push fresh data when a scan completes
    scanManager.onDidScan((result) => {
      this._sendMessage({ type: 'graphData', data: result });
    }, null, this._disposables);

    // Detect theme changes
    vscode.window.onDidChangeActiveColorTheme(
      (theme) => {
        this._sendMessage({
          type: 'theme',
          isDark: theme.kind !== vscode.ColorThemeKind.Light,
        });
      },
      null,
      this._disposables,
    );
  }

  /** Open (or reveal) the webview panel. */
  static createOrShow(
    extensionUri: vscode.Uri,
    scanManager: ScanManager,
    workspaceRoot: string,
  ): WebviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (WebviewPanel._instance) {
      WebviewPanel._instance._panel.reveal(column);
      // Send latest data if available
      if (scanManager.lastResult) {
        WebviewPanel._instance._sendMessage({
          type: 'graphData',
          data: scanManager.lastResult,
        });
      }
      return WebviewPanel._instance;
    }

    const panel = new WebviewPanel(extensionUri, scanManager, workspaceRoot);
    WebviewPanel._instance = panel;
    return panel;
  }

  /** Send a typed message to the webview. */
  private _sendMessage(message: ExtensionMessage): void {
    if (!this._isReady) {
      // Queue graphData until the webview says it's ready
      if (message.type === 'graphData') {
        this._pendingData = message.data;
      }
      return;
    }
    this._panel.webview.postMessage(message);
  }

  /** Handle incoming messages from the webview React app. */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready': {
        this._isReady = true;

        // Send theme first
        const isDark =
          vscode.window.activeColorTheme.kind !== vscode.ColorThemeKind.Light;
        this._panel.webview.postMessage({ type: 'theme', isDark });

        // Send pending or latest scan data
        const data = this._pendingData ?? this.scanManager.lastResult;
        if (data) {
          this._panel.webview.postMessage({ type: 'graphData', data });
          this._pendingData = undefined;
        }
        break;
      }

      case 'openFile': {
        await openFile(message.filePath, message.line);
        break;
      }

      case 'requestScan': {
        this._sendMessage({ type: 'scanProgress', message: 'Scanning…' });
        await this.scanManager.scan(this.workspaceRoot);
        break;
      }

      case 'exportGraph': {
        const result = this.scanManager.lastResult;
        if (!result) return;

        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('dependency-graph.json'),
          filters: { JSON: ['json'] },
        });

        if (uri) {
          const json = exportGraphJSON(result.graph);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
          vscode.window.showInformationMessage(
            `React Dependency Graph: Exported to ${uri.fsPath}`,
          );
        }
        break;
      }
    }
  }

  dispose(): void {
    WebviewPanel._instance = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }
}
