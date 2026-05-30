// ============================================================================
// commands — Register all VS Code command palette entries
// ============================================================================

import * as vscode from 'vscode';
import { exportGraphJSON } from '@rdg/core';
import type { ScanManager } from './ScanManager.js';
import { WebviewPanel } from './webview/WebviewPanel.js';
import { openFile } from './utils/openFile.js';

/**
 * Register all rdg.* commands and return their disposables.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  scanManager: ScanManager,
  workspaceRoot: () => string | undefined,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // ── rdg.scan ─────────────────────────────────────────────────────────
  disposables.push(
    vscode.commands.registerCommand('rdg.scan', async () => {
      const root = workspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage(
          'React Dependency Graph: No workspace folder open.',
        );
        return;
      }
      await scanManager.scan(root);
    }),
  );

  // ── rdg.refresh ──────────────────────────────────────────────────────
  // Same as scan, exposed separately so the Tree View title bar can use it
  disposables.push(
    vscode.commands.registerCommand('rdg.refresh', async () => {
      const root = workspaceRoot();
      if (!root) return;
      await scanManager.scan(root);
    }),
  );

  // ── rdg.showGraph ────────────────────────────────────────────────────
  disposables.push(
    vscode.commands.registerCommand('rdg.showGraph', async () => {
      const root = workspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage(
          'React Dependency Graph: No workspace folder open.',
        );
        return;
      }

      // If no scan yet, run one first
      if (!scanManager.lastResult) {
        await scanManager.scan(root);
      }

      WebviewPanel.createOrShow(context.extensionUri, scanManager, root);
    }),
  );

  // ── rdg.exportJson ───────────────────────────────────────────────────
  disposables.push(
    vscode.commands.registerCommand('rdg.exportJson', async () => {
      let result = scanManager.lastResult;

      if (!result) {
        const root = workspaceRoot();
        if (!root) {
          vscode.window.showErrorMessage(
            'React Dependency Graph: No workspace folder open.',
          );
          return;
        }
        result = await scanManager.scan(root);
      }

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
    }),
  );

  // ── rdg.openFile ─────────────────────────────────────────────────────
  // Internal command used by tree view items and webview node clicks
  disposables.push(
    vscode.commands.registerCommand(
      'rdg.openFile',
      async (absolutePath: string) => {
        await openFile(absolutePath);
      },
    ),
  );

  return disposables;
}
