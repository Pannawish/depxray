// ============================================================================
// DependencyTreeProvider — Sidebar tree view data provider
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import type { ScanResult, GraphNode } from '@rdg/core';
import { DependencyTreeItem } from './DependencyTreeItem.js';
import type { ScanManager } from '../ScanManager.js';

export class DependencyTreeProvider
  implements vscode.TreeDataProvider<DependencyTreeItem>
{
  private _scanResult: ScanResult | undefined;

  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<DependencyTreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly scanManager: ScanManager) {
    // Auto-refresh whenever a scan completes
    scanManager.onDidScan((result) => {
      this._scanResult = result;
      this._onDidChangeTreeData.fire();
    });
  }

  /** Called by VS Code to get tree item UI representation. */
  getTreeItem(element: DependencyTreeItem): vscode.TreeItem {
    return element;
  }

  /** Called by VS Code to get children of a node (or root if undefined). */
  getChildren(element?: DependencyTreeItem): DependencyTreeItem[] {
    if (!this._scanResult) {
      return [];
    }

    if (!element) {
      // Root level: build the full tree from scan result
      return this._buildRootItems(this._scanResult);
    }

    // Directory element: return its children
    if (element.kind === 'directory') {
      return element.children;
    }

    return [];
  }

  /**
   * Build top-level directory items from the scan result.
   * Groups files by their top-level directory under the project root.
   */
  private _buildRootItems(result: ScanResult): DependencyTreeItem[] {
    const rootDir = result.graph.rootDir;
    const nodes = result.graph.nodes;

    // Sort nodes: circular first, then by path
    const sorted = [...nodes].sort((a, b) => {
      if (a.isCircular !== b.isCircular) return a.isCircular ? -1 : 1;
      return a.relativePath.localeCompare(b.relativePath);
    });

    // Group by top-level directory
    const dirMap = new Map<string, GraphNode[]>();
    const rootFiles: GraphNode[] = [];

    for (const node of sorted) {
      const parts = node.relativePath.split('/');
      if (parts.length === 1) {
        // File directly in root
        rootFiles.push(node);
      } else {
        const topDir = parts[0];
        if (!dirMap.has(topDir)) dirMap.set(topDir, []);
        dirMap.get(topDir)!.push(node);
      }
    }

    const items: DependencyTreeItem[] = [];

    // Directory groups first
    for (const [dirName, dirNodes] of [...dirMap.entries()].sort()) {
      const dirAbsPath = path.join(rootDir, dirName);
      const dirItem = new DependencyTreeItem({
        label: dirName,
        kind: 'directory',
        absolutePath: dirAbsPath,
      });

      // Add children (nested paths under this dir)
      for (const node of dirNodes) {
        // Label is the path relative to this top-level dir
        const relToDir = node.relativePath.slice(dirName.length + 1);
        const fileItem = new DependencyTreeItem({
          label: relToDir,
          kind: 'file',
          absolutePath: node.id,
          graphNode: node,
        });
        dirItem.children.push(fileItem);
      }

      // Show count badge on directory
      dirItem.description = `${dirNodes.length} files`;
      const hasCircular = dirNodes.some((n) => n.isCircular);
      if (hasCircular) {
        dirItem.iconPath = new vscode.ThemeIcon(
          'folder-active',
          new vscode.ThemeColor('list.warningForeground'),
        );
      }

      items.push(dirItem);
    }

    // Root-level files
    for (const node of rootFiles) {
      items.push(
        new DependencyTreeItem({
          label: node.relativePath,
          kind: 'file',
          absolutePath: node.id,
          graphNode: node,
        }),
      );
    }

    return items;
  }

  /** Force a tree refresh (called by rdg.refresh command). */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
