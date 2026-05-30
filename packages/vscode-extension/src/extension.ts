// ============================================================================
// React Dependency Graph — VS Code Extension Entry Point
// ============================================================================
// This is a thin wiring layer. All business logic lives in:
//   - ScanManager     — scan orchestration + shared state
//   - commands.ts     — command palette entries
//   - statusBar.ts    — status bar item
//   - DependencyTreeProvider — sidebar tree view
//   - WebviewPanel    — interactive graph webview
// ============================================================================

import * as vscode from 'vscode';
import { ScanManager } from './ScanManager.js';
import { RdgStatusBar } from './statusBar.js';
import { registerCommands } from './commands.js';
import { DependencyTreeProvider } from './treeView/DependencyTreeProvider.js';

let scanManager: ScanManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('React Dependency Graph extension activated');

  // ── Output channel ────────────────────────────────────────────────────
  const outputChannel = vscode.window.createOutputChannel(
    'React Dependency Graph',
  );
  context.subscriptions.push(outputChannel);

  // ── Core scan manager ─────────────────────────────────────────────────
  scanManager = new ScanManager(outputChannel);
  context.subscriptions.push(scanManager);

  // ── Status bar ────────────────────────────────────────────────────────
  const statusBar = new RdgStatusBar();
  context.subscriptions.push(statusBar);

  scanManager.onDidStartScan(() => statusBar.setScanning());
  scanManager.onDidScan((result) => statusBar.setResult(result));

  // ── Workspace root helper ─────────────────────────────────────────────
  const workspaceRoot = (): string | undefined => {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
  };

  // ── Commands ──────────────────────────────────────────────────────────
  const commandDisposables = registerCommands(
    context,
    scanManager,
    workspaceRoot,
  );
  context.subscriptions.push(...commandDisposables);

  // ── Tree View ─────────────────────────────────────────────────────────
  const treeProvider = new DependencyTreeProvider(scanManager);
  const treeView = vscode.window.createTreeView('rdg.dependencyTree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView, treeProvider);

  // ── Auto-scan on activation if a workspace is open ───────────────────
  // Small delay so the workspace folders are fully resolved
  const root = workspaceRoot();
  if (root) {
    setTimeout(() => scanManager?.scan(root), 500);
  }
}

export function deactivate(): void {
  scanManager = undefined;
}
