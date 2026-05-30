import React, { useState } from 'react';
import type { ExplorerGraphNode } from '../types.js';
import type { FileRelationshipIndex } from '../relationshipIndex.js';

interface AiContextGeneratorProps {
  node: ExplorerGraphNode | null;
  index: FileRelationshipIndex;
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f6b59" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export function AiContextGenerator({ node, index }: AiContextGeneratorProps) {
  const [copied, setCopied] = useState(false);

  if (!node || node.kind === 'directory') {
    return null; // Only show for files
  }

  const generateContext = () => {
    let md = `# File Context: \`${node.relativePath}\`\n\n`;
    
    // Outgoing dependencies (Imports)
    const outgoing = index.importsBySourceId.get(node.id) || [];
    if (outgoing.length > 0) {
      md += `## Dependencies (What this file imports)\n`;
      outgoing.forEach(dep => {
        const targetNode = index.structureNodeById.get(dep.target);
        if (targetNode) {
          md += `- \`${targetNode.relativePath}\`\n`;
        }
      });
      md += `\n`;
    }

    // Incoming dependencies (Dependents)
    const incoming = index.importedByTargetId.get(node.id) || [];
    if (incoming.length > 0) {
      md += `## Dependents (Files that import this one)\n`;
      incoming.forEach(dep => {
        const sourceNode = index.structureNodeById.get(dep.source);
        if (sourceNode) {
          md += `- \`${sourceNode.relativePath}\`\n`;
        }
      });
      md += `\n`;
    }

    if (outgoing.length === 0 && incoming.length === 0) {
      md += `*This file has no tracked dependencies.*`;
    }

    return md;
  };

  const handleCopy = async () => {
    const text = generateContext();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <div className="ai-context-panel">
      <div className="ai-context-header">
        <h3>AI Context Generator</h3>
        <p className="subtitle-meta">Generate markdown context for LLMs</p>
      </div>
      <div className="ai-context-body">
        <p className="ai-context-desc">
          Copy a summary of this file's imports and dependents to paste into your AI agent.
        </p>
        <button 
          className={`ai-copy-btn ${copied ? 'copied' : ''}`} 
          onClick={handleCopy}
        >
          {copied ? (
            <><CheckIcon /> Copied to Clipboard!</>
          ) : (
            <><CopyIcon /> Copy Markdown Context</>
          )}
        </button>
      </div>
    </div>
  );
}
