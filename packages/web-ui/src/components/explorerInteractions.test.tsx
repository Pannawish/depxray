// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTreeView, type FileTreeRowData } from './FileTreeView.js';
import { GraphContextBar } from './GraphContextBar.js';

afterEach(cleanup);

const folderRow: FileTreeRowData = {
  node: {
    id: '/project/src',
    label: 'src',
    relativePath: 'src',
    absolutePath: '/project/src',
    kind: 'directory',
    extension: null,
    depth: 1,
    collapsed: false,
    hidden: false,
    childCount: 1,
    descendantCount: 1,
  },
  level: 0,
  hasChildren: true,
  expanded: false,
  matched: false,
  circular: false,
  orphan: false,
  unusedExports: false,
  unresolvedImports: false,
};

describe('explorer interactions', () => {
  it('keeps folder expansion separate from folder selection', async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    const onToggleFolder = vi.fn();
    render(
      <FileTreeView
        rows={[folderRow]}
        selectedNodeId={null}
        onSelectNode={onSelectNode}
        onToggleFolder={onToggleFolder}
        onDragStart={vi.fn()}
        onDrop={vi.fn()}
        onSwap={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Expand src' }));
    expect(onToggleFolder).toHaveBeenCalledWith('/project/src');
    expect(onSelectNode).not.toHaveBeenCalled();

    await user.click(screen.getByRole('treeitem', { name: /src/ }));
    expect(onSelectNode).toHaveBeenCalledWith('/project/src');
  });

  it('exposes only valid graph scopes and reports scope changes', async () => {
    const user = userEvent.setup();
    const onScopeModeChange = vi.fn();
    const { rerender } = render(
      <GraphContextBar
        scopeMode="project"
        canUseFolderScope
        canUseFileScope={false}
        neighborhoodDepth={1}
        folderBoundaryMode="all"
        breadcrumbs={[]}
        pathResult={null}
        pathLabel={null}
        onScopeModeChange={onScopeModeChange}
        onNeighborhoodDepthChange={vi.fn()}
        onFolderBoundaryModeChange={vi.fn()}
        onBreadcrumbSelect={vi.fn()}
        onClearPath={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'File neighborhood' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Folder' }));
    expect(onScopeModeChange).toHaveBeenCalledWith('folder');

    rerender(
      <GraphContextBar
        scopeMode="file"
        canUseFolderScope
        canUseFileScope
        neighborhoodDepth={1}
        folderBoundaryMode="all"
        breadcrumbs={[]}
        pathResult={null}
        pathLabel={null}
        onScopeModeChange={onScopeModeChange}
        onNeighborhoodDepthChange={vi.fn()}
        onFolderBoundaryModeChange={vi.fn()}
        onBreadcrumbSelect={vi.fn()}
        onClearPath={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Dependency neighborhood depth')).toBeTruthy();
  });
});
