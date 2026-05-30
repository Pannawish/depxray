// ============================================================================
// getWebviewContent — Generate the HTML shell for the webview
// ============================================================================
// The webview loads the compiled Vite bundle (webview-ui/dist).
// We inject the correct asset URIs and a strict Content Security Policy.
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Generate the HTML content for the dependency graph webview.
 *
 * @param webview - The VS Code webview instance (needed for URI conversion and nonce)
 * @param extensionUri - The extension's root URI (to locate webview-ui/dist assets)
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  // Locate the compiled webview-ui assets
  const distUri = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distUri, 'assets', 'index.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distUri, 'assets', 'index.css'),
  );

  // Nonce for inline scripts — required by VS Code's CSP
  const nonce = getNonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
      font-src ${webview.cspSource};
      img-src ${webview.cspSource} data:;
    "
  />
  <link rel="stylesheet" href="${styleUri}" />
  <title>React Dependency Graph</title>
  <style>
    /* Ensure the React app fills the entire webview */
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/** Generate a random nonce for Content Security Policy. */
function getNonce(): string {
  let nonce = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    nonce += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return nonce;
}
