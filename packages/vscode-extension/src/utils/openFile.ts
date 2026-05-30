// ============================================================================
// openFile — Open a file in the VS Code editor
// ============================================================================

import * as vscode from 'vscode';

/**
 * Open a file in the VS Code editor by its absolute path.
 * Places the file in the main editor column and focuses it.
 */
export async function openFile(absolutePath: string, line?: number): Promise<void> {
  try {
    const uri = vscode.Uri.file(absolutePath);
    const doc = await vscode.workspace.openTextDocument(uri);

    const options: vscode.TextDocumentShowOptions = {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    };

    if (line !== undefined) {
      // Position the cursor at the given line
      const position = new vscode.Position(Math.max(0, line - 1), 0);
      options.selection = new vscode.Range(position, position);
    }

    await vscode.window.showTextDocument(doc, options);
  } catch (err) {
    vscode.window.showErrorMessage(
      `React Dependency Graph: Could not open file — ${(err as Error).message}`,
    );
  }
}
