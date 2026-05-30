import {
  filterDependencyEdges,
  type FileRelationshipIndex,
  type FolderSummary,
} from '../relationshipIndex.js';
import type {
  DependencyFilters,
  ExplorerGraphEdge,
  ExplorerGraphNode,
} from '../types.js';

interface RelationshipPanelProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
  folderSummary: FolderSummary | null;
  filters: DependencyFilters;
  onSelectNode: (nodeId: string) => void;
}

function edgeMatchesCircularFocus(
  edge: ExplorerGraphEdge,
  index: FileRelationshipIndex,
  enabled: boolean,
): boolean {
  if (!enabled) {
    return true;
  }

  return index.circularNodeIds.has(edge.source) || index.circularNodeIds.has(edge.target);
}

function getEdgePeerNode(
  edge: ExplorerGraphEdge,
  direction: 'imports' | 'importedBy',
  index: FileRelationshipIndex,
): ExplorerGraphNode | null {
  const peerId = direction === 'imports' ? edge.target : edge.source;
  return index.nodeById.get(peerId) ?? null;
}

function RelationshipList({
  title,
  edges,
  direction,
  index,
  emptyLabel,
  onSelectNode,
}: {
  title: string;
  edges: ExplorerGraphEdge[];
  direction: 'imports' | 'importedBy';
  index: FileRelationshipIndex;
  emptyLabel: string;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <section className="relationship-section">
      <div className="relationship-heading">
        <h3>{title}</h3>
        <span>{edges.length}</span>
      </div>

      {edges.length ? (
        <div className="relationship-list">
          {edges.map((edge) => {
            const peerNode = getEdgePeerNode(edge, direction, index);
            const pathLabel = peerNode?.relativePath ?? (
              direction === 'imports' ? edge.target : edge.source
            );

            return (
              <button
                className={[
                  'relationship-item',
                  peerNode?.isCircular ? 'circular' : '',
                ].filter(Boolean).join(' ')}
                key={edge.id}
                onClick={() => {
                  if (peerNode) {
                    onSelectNode(peerNode.id);
                  }
                }}
                type="button"
              >
                <span className="relationship-path">{pathLabel}</span>
                <span className="relationship-specifier">{edge.importSpecifier}</span>
                <span className="badge-row compact">
                  {edge.isTypeOnly ? <span>type-only</span> : null}
                  {edge.isDynamic ? <span>dynamic</span> : null}
                  {peerNode?.isCircular ? <span className="danger">circular</span> : null}
                  {edge.importedNames.length ? (
                    <span>{edge.importedNames.join(', ')}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-copy">{emptyLabel}</p>
      )}
    </section>
  );
}

function CircularFileList({
  files,
  onSelectNode,
}: {
  files: ExplorerGraphNode[];
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <section className="relationship-section">
      <div className="relationship-heading">
        <h3>Circular files</h3>
        <span>{files.length}</span>
      </div>
      {files.length ? (
        <div className="relationship-list">
          {files.map((file) => (
            <button
              className="relationship-item circular"
              key={file.id}
              onClick={() => onSelectNode(file.id)}
              type="button"
            >
              <span className="relationship-path">{file.relativePath}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-copy">No circular files in this selection.</p>
      )}
    </section>
  );
}

export function RelationshipPanel({
  node,
  index,
  folderSummary,
  filters,
  onSelectNode,
}: RelationshipPanelProps) {
  if (!node) {
    return (
      <section className="relationships-panel">
        <div className="panel-header">
          <p className="eyebrow">Relationships</p>
          <h2>Select a file or folder</h2>
        </div>
      </section>
    );
  }

  if (node.kind === 'directory' && folderSummary) {
    const internalImports = folderSummary.internalImports.filter((edge) => (
      edgeMatchesCircularFocus(edge, index, filters.circularOnly)
    ));
    const incomingExternal = folderSummary.incomingExternal.filter((edge) => (
      edgeMatchesCircularFocus(edge, index, filters.circularOnly)
    ));
    const outgoingExternal = folderSummary.outgoingExternal.filter((edge) => (
      edgeMatchesCircularFocus(edge, index, filters.circularOnly)
    ));

    return (
      <section className="relationships-panel">
        <div className="panel-header">
          <p className="eyebrow">Folder relationships</p>
          <h2>{node.relativePath}</h2>
        </div>
        <RelationshipList
          title="Internal imports"
          edges={internalImports}
          direction="imports"
          index={index}
          emptyLabel="No internal imports in this folder."
          onSelectNode={onSelectNode}
        />
        <RelationshipList
          title="Incoming external references"
          edges={incomingExternal}
          direction="importedBy"
          index={index}
          emptyLabel="No files outside this folder import files inside it."
          onSelectNode={onSelectNode}
        />
        <RelationshipList
          title="Outgoing external references"
          edges={outgoingExternal}
          direction="imports"
          index={index}
          emptyLabel="No files inside this folder import files outside it."
          onSelectNode={onSelectNode}
        />
        <CircularFileList
          files={folderSummary.circularFiles}
          onSelectNode={onSelectNode}
        />
      </section>
    );
  }

  const imports = filterDependencyEdges(index.importsBySourceId.get(node.id) ?? [], filters)
    .filter((edge) => edgeMatchesCircularFocus(edge, index, filters.circularOnly));
  const importedBy = filterDependencyEdges(index.importedByTargetId.get(node.id) ?? [], filters)
    .filter((edge) => edgeMatchesCircularFocus(edge, index, filters.circularOnly));
  const relatedCircularFiles = Array.from(new Set([
    ...imports.map((edge) => edge.target),
    ...importedBy.map((edge) => edge.source),
  ]))
    .filter((nodeId) => index.circularNodeIds.has(nodeId))
    .map((nodeId) => index.nodeById.get(nodeId))
    .filter((item): item is ExplorerGraphNode => Boolean(item));

  return (
    <section className="relationships-panel">
      <div className="panel-header">
        <p className="eyebrow">File relationships</p>
        <h2>{node.relativePath}</h2>
      </div>
      <RelationshipList
        title="Imports"
        edges={imports}
        direction="imports"
        index={index}
        emptyLabel="This file has no matching outgoing imports."
        onSelectNode={onSelectNode}
      />
      <RelationshipList
        title="Imported by"
        edges={importedBy}
        direction="importedBy"
        index={index}
        emptyLabel="No matching files import this file."
        onSelectNode={onSelectNode}
      />
      <CircularFileList
        files={node.isCircular ? [node, ...relatedCircularFiles] : relatedCircularFiles}
        onSelectNode={onSelectNode}
      />
    </section>
  );
}
