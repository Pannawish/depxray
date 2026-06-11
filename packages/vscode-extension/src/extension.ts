import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';

const diagnosticCollectionName = 'depxray';

interface DepxrayNode {
  file: string;
  imports?: DepxrayNode[];
}

interface DepxrayInspectResult {
  inDegree: number;
  outDegree: number;
}

function workspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

function runDepxray(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile('npx', ['depxray', ...args], { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function spawnDepxray(args: string[], cwd: string): void {
  const child = cp.spawn('npx', ['depxray', ...args], {
    cwd,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function currentRelativeFile(): string | null {
  const root = workspaceRoot();
  const editor = vscode.window.activeTextEditor;
  if (!root || !editor) {
    return null;
  }

  return path.relative(root, editor.document.uri.fsPath).replaceAll('\\', '/');
}

async function inspectFile(root: string, relativeFile: string): Promise<DepxrayInspectResult | null> {
  try {
    const stdout = await runDepxray(['inspect', relativeFile, '--dir', root, '--format', 'json'], root);
    return JSON.parse(stdout) as DepxrayInspectResult;
  } catch {
    return null;
  }
}

class DepxrayCodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const root = workspaceRoot();
    if (!root || document.uri.scheme !== 'file') {
      return [];
    }

    const relativeFile = path.relative(root, document.uri.fsPath).replaceAll('\\', '/');
    const summary = await inspectFile(root, relativeFile);
    const title = summary
      ? `depxray: ${summary.outDegree} imports, ${summary.inDegree} dependents`
      : 'depxray: inspect dependencies';

    return [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title,
        command: 'depxray.openCurrentFile',
        arguments: [relativeFile],
      }),
    ];
  }
}

class DependencyTreeProvider implements vscode.TreeDataProvider<DepxrayNode> {
  private readonly emitter = new vscode.EventEmitter<DepxrayNode | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private rootNode: DepxrayNode | null = null;

  refresh(node: DepxrayNode | null): void {
    this.rootNode = node;
    this.emitter.fire();
  }

  getTreeItem(element: DepxrayNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.file,
      element.imports?.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    item.contextValue = 'depxrayNode';
    return item;
  }

  getChildren(element?: DepxrayNode): DepxrayNode[] {
    if (!element) {
      return this.rootNode ? [this.rootNode] : [];
    }
    return element.imports ?? [];
  }
}

async function refreshDiagnostics(collection: vscode.DiagnosticCollection): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    return;
  }

  const stdout = await runDepxray(['scan', root, '--mode', 'dependencies', '--json', '--unused-exports', '--unresolved'], root);
  const data = JSON.parse(stdout) as {
    nodes: Array<{
      relativePath: string;
      isCircular?: boolean;
      unusedExports?: Array<{ name: string; line: number }>;
    }>;
    unresolvedImports?: Array<{ file: string; importSpecifier: string; line: number }>;
  };
  const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

  for (const node of data.nodes) {
    for (const unusedExport of node.unusedExports ?? []) {
      const diagnostics = diagnosticsByFile.get(node.relativePath) ?? [];
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(Math.max(0, unusedExport.line - 1), 0, Math.max(0, unusedExport.line - 1), 1),
        `Unused export: ${unusedExport.name}`,
        vscode.DiagnosticSeverity.Warning,
      ));
      diagnosticsByFile.set(node.relativePath, diagnostics);
    }

    if (node.isCircular) {
      const diagnostics = diagnosticsByFile.get(node.relativePath) ?? [];
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        'File participates in a circular dependency',
        vscode.DiagnosticSeverity.Warning,
      ));
      diagnosticsByFile.set(node.relativePath, diagnostics);
    }
  }

  for (const unresolvedImport of data.unresolvedImports ?? []) {
    const diagnostics = diagnosticsByFile.get(unresolvedImport.file) ?? [];
    diagnostics.push(new vscode.Diagnostic(
      new vscode.Range(Math.max(0, unresolvedImport.line - 1), 0, Math.max(0, unresolvedImport.line - 1), 1),
      `Unresolved import: ${unresolvedImport.importSpecifier}`,
      vscode.DiagnosticSeverity.Error,
    ));
    diagnosticsByFile.set(unresolvedImport.file, diagnostics);
  }

  collection.clear();
  for (const [relativeFile, diagnostics] of diagnosticsByFile) {
    collection.set(vscode.Uri.file(path.join(root, relativeFile)), diagnostics);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(diagnosticCollectionName);
  const treeProvider = new DependencyTreeProvider();
  context.subscriptions.push(diagnostics);
  context.subscriptions.push(vscode.window.registerTreeDataProvider('depxray.dependencyChains', treeProvider));
  context.subscriptions.push(vscode.languages.registerCodeLensProvider(
    [
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'javascriptreact' },
    ],
    new DepxrayCodeLensProvider(),
  ));

  context.subscriptions.push(vscode.commands.registerCommand('depxray.refreshDiagnostics', async () => {
    await refreshDiagnostics(diagnostics);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('depxray.openCurrentFile', async (relativeFile?: string) => {
    const root = workspaceRoot();
    const file = relativeFile ?? currentRelativeFile();
    if (!root || !file) {
      return;
    }

    const stdout = await runDepxray(['tree', file, root, '--json'], root);
    treeProvider.refresh(JSON.parse(stdout) as DepxrayNode);
    spawnDepxray(['scan', root, '--mode', 'dependencies'], root);
  }));

  void refreshDiagnostics(diagnostics);
}

export function deactivate(): void {}
