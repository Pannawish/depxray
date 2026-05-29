// ============================================================================
// React Dependency Graph — VS Code Extension Entry Point
// ============================================================================
// This is the main activation entry point for the VS Code extension.
// It registers commands, the tree view provider, and handles webview panels.
//
// Architecture:
//   - This file only does VS Code-specific wiring (commands, UI, events)
//   - All scanning logic lives in @rdg/core (platform-agnostic)
//   - The webview graph UI will be added in v0.5
// ============================================================================

import * as vscode from 'vscode';
import { scanProject, exportGraphJSON } from '@rdg/core';
import type { ScanResult } from '@rdg/core';

// Store the latest scan result so multiple views can access it
let lastScanResult: ScanResult | undefined;

/**
 * Called by VS Code when the extension is activated.
 *
 * Activation happens when:
 * - The user runs one of our commands
 * - The user opens the dependency tree view
 *
 * We register all commands and providers here.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('React Dependency Graph extension activated');

  // ── Register commands ──────────────────────────────────────────────

  // Command: Scan the current workspace
  const scanCommand = vscode.commands.registerCommand(
    'rdg.scan',
    async () => {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        vscode.window.showErrorMessage(
          'React Dependency Graph: No workspace folder open.',
        );
        return;
      }

      await runScan(workspaceRoot);
    },
  );

  // Command: Show the dependency graph (webview — placeholder for v0.5)
  const showGraphCommand = vscode.commands.registerCommand(
    'rdg.showGraph',
    async () => {
      if (!lastScanResult) {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage(
            'React Dependency Graph: No workspace folder open.',
          );
          return;
        }
        await runScan(workspaceRoot);
      }

      if (lastScanResult) {
        // TODO (v0.5): Open the React Flow webview panel
        vscode.window.showInformationMessage(
          `React Dependency Graph: ${lastScanResult.totalFiles} files, ` +
            `${lastScanResult.totalImports} imports, ` +
            `${lastScanResult.circularCount} circular chains. ` +
            `(Webview graph coming in v0.5)`,
        );
      }
    },
  );

  // Command: Export the dependency graph as JSON
  const exportJsonCommand = vscode.commands.registerCommand(
    'rdg.exportJson',
    async () => {
      if (!lastScanResult) {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage(
            'React Dependency Graph: No workspace folder open.',
          );
          return;
        }
        await runScan(workspaceRoot);
      }

      if (!lastScanResult) {
        return;
      }

      // Ask the user where to save
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('dependency-graph.json'),
        filters: {
          JSON: ['json'],
        },
      });

      if (uri) {
        const json = exportGraphJSON(lastScanResult.graph);
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(json, 'utf-8'),
        );
        vscode.window.showInformationMessage(
          `React Dependency Graph: Exported to ${uri.fsPath}`,
        );
      }
    },
  );

  // Register all disposables
  context.subscriptions.push(scanCommand, showGraphCommand, exportJsonCommand);
}

/**
 * Called by VS Code when the extension is deactivated.
 */
export function deactivate(): void {
  lastScanResult = undefined;
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Get the root path of the current workspace.
 */
function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

/**
 * Run the dependency scan with a progress indicator.
 */
async function runScan(rootDir: string): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'React Dependency Graph',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Scanning project...' });

      try {
        lastScanResult = await scanProject({ rootDir });

        const { totalFiles, totalImports, circularCount, durationMs } =
          lastScanResult;

        const message =
          `Scanned ${totalFiles} files, found ${totalImports} imports` +
          (circularCount > 0
            ? `, ⚠️ ${circularCount} circular dependencies`
            : '') +
          ` (${durationMs.toFixed(0)}ms)`;

        if (circularCount > 0) {
          vscode.window.showWarningMessage(
            `React Dependency Graph: ${message}`,
          );
        } else {
          vscode.window.showInformationMessage(
            `React Dependency Graph: ${message}`,
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `React Dependency Graph: Scan failed — ${(err as Error).message}`,
        );
      }
    },
  );
}
