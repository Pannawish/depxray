// ============================================================================
// ScanManager — Shared scan state and orchestration
// ============================================================================
// Single source of truth for the last scan result. All extension components
// (commands, tree view, webview) subscribe to the onDidScan event instead of
// holding their own copies of the result.
// ============================================================================

import * as vscode from 'vscode';
import { scanProject } from '@rdg/core';
import type { ScanResult } from '@rdg/core';

export class ScanManager {
  /** The most recent scan result, or undefined if no scan has run yet. */
  private _lastResult: ScanResult | undefined;

  /** Fires whenever a scan completes successfully. */
  private readonly _onDidScan = new vscode.EventEmitter<ScanResult>();
  public readonly onDidScan = this._onDidScan.event;

  /** Fires whenever a scan starts (used to show loading states). */
  private readonly _onDidStartScan = new vscode.EventEmitter<void>();
  public readonly onDidStartScan = this._onDidStartScan.event;

  private _isScanning = false;

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  get lastResult(): ScanResult | undefined {
    return this._lastResult;
  }

  get isScanning(): boolean {
    return this._isScanning;
  }

  /**
   * Run a full project scan with a progress notification.
   * Fires onDidStartScan at the beginning and onDidScan on success.
   */
  async scan(rootDir: string): Promise<ScanResult | undefined> {
    if (this._isScanning) {
      vscode.window.showWarningMessage('React Dependency Graph: A scan is already in progress.');
      return;
    }

    this._isScanning = true;
    this._onDidStartScan.fire();
    this.outputChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] Scanning: ${rootDir}`);

    let result: ScanResult | undefined;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'React Dependency Graph',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Scanning project...' });

        try {
          result = await scanProject({
            rootDir,
            detectCircular: true,
            resolveAliases: true,
          });

          this._lastResult = result;

          const { totalFiles, totalImports, circularCount, durationMs } = result;

          // Log detailed results to output channel
          this.outputChannel.appendLine(`✅ Scan complete in ${durationMs.toFixed(0)}ms`);
          this.outputChannel.appendLine(`   Files:    ${totalFiles}`);
          this.outputChannel.appendLine(`   Imports:  ${totalImports}`);
          this.outputChannel.appendLine(`   Circular: ${circularCount}`);

          if (result.errors.length > 0) {
            this.outputChannel.appendLine(`   Errors:   ${result.errors.length}`);
            for (const err of result.errors) {
              this.outputChannel.appendLine(`     ⚠ ${err.filePath}: ${err.error}`);
            }
          }

          if (circularCount > 0) {
            this.outputChannel.appendLine(`\n🔴 Circular dependencies:`);
            for (const chain of result.graph.circularDependencies) {
              this.outputChannel.appendLine(`   ↻ ${chain.description}`);
            }
          }

          // Build the notification message
          const summary =
            `Scanned ${totalFiles} files, ${totalImports} imports` +
            (circularCount > 0 ? `, ⚠️ ${circularCount} circular` : '') +
            ` (${durationMs.toFixed(0)}ms)`;

          if (circularCount > 0) {
            vscode.window.showWarningMessage(`React Dependency Graph: ${summary}`);
          } else {
            vscode.window.showInformationMessage(`React Dependency Graph: ${summary}`);
          }

          this._onDidScan.fire(result);
        } catch (err) {
          const message = (err as Error).message;
          this.outputChannel.appendLine(`❌ Scan failed: ${message}`);
          vscode.window.showErrorMessage(`React Dependency Graph: Scan failed — ${message}`);
        } finally {
          this._isScanning = false;
        }
      },
    );

    return result;
  }

  dispose(): void {
    this._onDidScan.dispose();
    this._onDidStartScan.dispose();
  }
}
