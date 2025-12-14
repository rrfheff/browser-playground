import React, { useMemo } from 'react';
import { usePlayground } from './PlaygroundProvider';
import type { PlaygroundFileTreeProps } from './types';

type TreeNode =
  | { type: 'folder'; name: string; path: string; children: TreeNode[] }
  | { type: 'file'; name: string; path: string };

type FolderNode = Extract<TreeNode, { type: 'folder' }>;

export const PlaygroundFileTree: React.FC<PlaygroundFileTreeProps> = ({
  height = '100%',
  width = 240,
  className,
  style
}) => {
  const { files, activeFilePath, setActiveFilePath } = usePlayground();

  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  return (
    <div
      className={className}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'auto',
        height,
        width,
        background: '#0b1224',
        color: '#e2e8f0',
        ...style
      }}
    >
      <div style={{ padding: '10px 10px 6px', fontSize: 12, color: '#94a3b8', letterSpacing: 0.4 }}>
        EXPLORER
      </div>
      <div style={{ padding: '0 6px 10px' }}>
        {tree.children.map((node) => (
          <TreeNodeView
            key={node.path}
            node={node}
            depth={0}
            activeFilePath={activeFilePath}
            onSelectFile={setActiveFilePath}
          />
        ))}
      </div>
    </div>
  );
};

const TreeNodeView: React.FC<{
  node: TreeNode;
  depth: number;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
}> = ({ node, depth, activeFilePath, onSelectFile }) => {
  if (node.type === 'folder') {
    return (
      <div>
        <div
          style={{
            padding: '4px 8px',
            marginLeft: depth * 10,
            fontSize: 12,
            color: '#cbd5e1',
            textTransform: 'uppercase',
            letterSpacing: 0.6
          }}
        >
          {node.name}
        </div>
        {node.children.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  const isActive = normalizePath(node.path) === normalizePath(activeFilePath);

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 0,
        background: isActive ? '#1d2a4f' : 'transparent',
        color: isActive ? '#e2e8f0' : '#cbd5e1',
        borderRadius: 8,
        padding: '6px 8px',
        marginLeft: depth * 10
      }}
    >
      <span style={{ width: 16, opacity: 0.8, marginRight: 6 }}>●</span>
      <span style={{ fontSize: 13 }}>{node.name}</span>
    </button>
  );
};

const buildTree = (paths: string[]): FolderNode => {
  const root: FolderNode = { type: 'folder', name: '', path: '/', children: [] };

  for (const rawPath of paths.map(normalizePath).sort()) {
    const parts = rawPath.split('/').filter(Boolean);
    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      currentPath += `/${part}`;
      const isLeaf = i === parts.length - 1;

      if (isLeaf) {
        current.children.push({ type: 'file', name: part, path: currentPath });
        continue;
      }

      let folder = current.children.find(
        (child): child is FolderNode =>
          child.type === 'folder' && child.name === part
      );
      if (!folder) {
        folder = { type: 'folder', name: part, path: currentPath, children: [] };
        current.children.push(folder);
      }
      current = folder;
    }
  }

  sortTree(root);
  return root;
};

const sortTree = (node: TreeNode) => {
  if (node.type !== 'folder') return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) sortTree(child);
};

const normalizePath = (path: string) => {
  const replaced = path.replace(/\\/g, '/');
  const ensured = replaced.startsWith('/') ? replaced : `/${replaced}`;
  return ensured.replace(/\/+/g, '/');
};
