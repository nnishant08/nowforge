import { useState, useEffect } from 'react';
import type { UibComponentNode } from '../../../shared/messaging.js';

export interface ComponentTreeProps {
  root: UibComponentNode | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function ComponentTree({ root, selectedId, onSelect, onHover }: ComponentTreeProps) {
  if (!root) return <div className="uib-tree__empty">No components found.</div>;
  return (
    <ul className="uib-tree" role="tree">
      <TreeNode
        node={root}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
        onHover={onHover}
        defaultOpen
      />
    </ul>
  );
}

interface TreeNodeProps {
  node: UibComponentNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  defaultOpen?: boolean;
}

function TreeNode({ node, depth, selectedId, onSelect, onHover, defaultOpen }: TreeNodeProps) {
  // Auto-expand top two levels by default
  const [open, setOpen] = useState(defaultOpen ?? depth < 2);

  // Re-open when the tree root changes (caller passes a fresh root)
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <li className="uib-tree__node">
      <div
        className={`uib-tree__row${isSelected ? ' uib-tree__row--selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        role="treeitem"
        aria-expanded={hasChildren ? open : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className="uib-tree__toggle"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="uib-tree__bullet" aria-hidden>·</span>
        )}
        <span className="uib-tree__main">
          <span className="uib-tree__name">{node.displayName}</span>
          <span className="uib-tree__tag">{node.tag !== node.displayName && `<${node.tag}>`}</span>
          {node.preview && <span className="uib-tree__preview">— {node.preview}</span>}
          {node.isClosedShadowHost && (
            <span className="uib-tree__shadow" title="Closed shadow root — children are not readable">
              🔒
            </span>
          )}
        </span>
      </div>
      {hasChildren && open && (
        <ul className="uib-tree__children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
