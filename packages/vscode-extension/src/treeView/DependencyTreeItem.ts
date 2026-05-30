// ============================================================================
// DependencyTreeItem — A single item in the sidebar tree view
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import type { GraphNode } from '@rdg/core';

export type TreeItemKind = 'directory' | 'file';

export class DependencyTreeItem extends vscode.TreeItem {
  public readonly kind: TreeItemKind;
  public readonly absolutePath: string;
  public readonly graphNode: GraphNode | undefined;
  public readonly children: DependencyTreeItem[] = [];

  constructor(options: {
    label: string;
    kind: TreeItemKind;
    absolutePath: string;
    graphNode?: GraphNode;
  }) {
    super(
      options.label,
      options.kind === 'directory'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );

    this.kind = options.kind;
    this.absolutePath = options.absolutePath;
    this.graphNode = options.graphNode;

    if (options.kind === 'directory') {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'rdg-directory';
    } else {
      this._configureFileItem(options.graphNode!);
    }
  }

  private _configureFileItem(node: GraphNode): void {
    // Icon: warning for circular, else use file-type icon
    if (node.isCircular) {
      this.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('list.warningForeground'),
      );
    } else {
      this.iconPath = this._iconForExtension(node.extension);
    }

    // Description: show import counts to the right of the label
    const parts: string[] = [];
    if (node.inDegree > 0) parts.push(`↑${node.inDegree}`);
    if (node.outDegree > 0) parts.push(`→${node.outDegree}`);
    if (node.isCircular) parts.push('🔴 circular');
    this.description = parts.join('  ');

    // Tooltip: full relative path + counts
    this.tooltip = new vscode.MarkdownString(
      `**${node.relativePath}**\n\n` +
        `- Imported by: ${node.inDegree} files\n` +
        `- Imports: ${node.outDegree} files\n` +
        (node.isCircular ? '\n⚠️ Part of a circular dependency' : ''),
    );

    // Command: open the file in editor on click
    this.command = {
      command: 'rdg.openFile',
      title: 'Open File',
      arguments: [node.id],
    };

    this.contextValue = node.isCircular ? 'rdg-file-circular' : 'rdg-file';
    this.resourceUri = vscode.Uri.file(node.id);
  }

  private _iconForExtension(ext: string): vscode.ThemeIcon {
    switch (ext) {
      case '.tsx':
        return new vscode.ThemeIcon('symbol-class');
      case '.ts':
        return new vscode.ThemeIcon('symbol-interface');
      case '.jsx':
      case '.js':
        return new vscode.ThemeIcon('symbol-method');
      default:
        return new vscode.ThemeIcon('file');
    }
  }
}
