import './runtimePolyfills';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { usePlayground } from './PlaygroundProvider';
import { PlaygroundFileTree } from './PlaygroundFileTree';
import type { PlaygroundEditorProps } from './types';

export const PlaygroundEditor: React.FC<PlaygroundEditorProps> = ({
  height = '100%',
  className,
  style,
  language,
  showFileTree,
  fileTreeDefaultOpen = true,
  fileTreeWidth = 240
}) => {
  const { code, setCode, activeFilePath, files, plugins } = usePlayground();
  const monacoRef = useRef<any>(null);
  const filesRef = useRef(files);
  const pluginsRef = useRef(plugins);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(fileTreeDefaultOpen);

  useEffect(() => {
    setIsFileTreeOpen(fileTreeDefaultOpen);
  }, [fileTreeDefaultOpen]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    pluginsRef.current = plugins;
  }, [plugins]);

  const handleBeforeMount = useCallback((monaco: any) => {
    monacoRef.current = monaco;
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      // Required for TSX parsing/highlighting when models are backed by .tsx filenames.
      jsx: monaco.languages.typescript.JsxEmit.Preserve,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowJs: true,
      allowNonTsExtensions: true,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true
    });
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

    injectVirtualFilesIntoMonaco(monaco, filesRef.current);

    for (const plugin of pluginsRef.current) {
      if (!plugin.setupMonaco) continue;
      try {
        const result = plugin.setupMonaco(monaco);
        if (result && typeof (result as any).then === 'function') {
          (result as Promise<void>).catch((err) => console.warn('[playground] plugin.setupMonaco failed', err));
        }
      } catch (err) {
        console.warn('[playground] plugin.setupMonaco failed', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!monacoRef.current) return;
    injectVirtualFilesIntoMonaco(monacoRef.current, files);
  }, [files]);

  return (
    <div
      className={className}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        height,
        display: 'flex',
        minWidth: 0,
        ...style
      }}
    >
      {shouldShowFileTree(showFileTree, files) && (
        <div
          style={{
            width: isFileTreeOpen ? fileTreeWidth : 34,
            borderRight: '1px solid #0f172a',
            background: '#0b1224',
            flex: '0 0 auto',
            height: '100%'
          }}
        >
          {isFileTreeOpen ? (
            <div style={{ height: '100%', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsFileTreeOpen(false);
                  }}
                  title="Collapse"
                  style={iconButtonStyle}
                >
                  ⟨
                </button>
              </div>
              <PlaygroundFileTree
                height="100%"
                width="100%"
                style={{ border: 'none', borderRadius: 0, background: 'transparent' }}
              />
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsFileTreeOpen(true);
                }}
                title="Files"
                style={iconButtonStyle}
              >
                ≡
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
        <Editor
          height="100%"
          defaultLanguage={language ?? languageFromPath(activeFilePath)}
          path={`file://${activeFilePath}`}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          beforeMount={handleBeforeMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            smoothScrolling: true,
            tabSize: 2,
            fixedOverflowWidgets: true
          }}
        />
      </div>
    </div>
  );
};

const shouldShowFileTree = (showFileTree: boolean | undefined, files: Record<string, string>) => {
  if (typeof showFileTree === 'boolean') return showFileTree;
  return Object.keys(files).length > 1;
};

const iconButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(226, 232, 240, 0.18)',
  background: 'rgba(15, 23, 42, 0.25)',
  color: '#e2e8f0',
  cursor: 'pointer',
  borderRadius: 8,
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1
};

const injectVirtualFilesIntoMonaco = (monaco: any, files: Record<string, string>) => {
  for (const [rawPath, code] of Object.entries(files)) {
    const normalizedPath = normalizeVfsPath(rawPath);
    const uri = monaco.Uri.parse(`file://${normalizedPath}`);
    const existing = monaco.editor.getModel(uri);
    const language = languageFromPath(normalizedPath);

    if (!existing) {
      monaco.editor.createModel(code, language, uri);
      continue;
    }

    if (existing.getLanguageId && existing.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(existing, language);
    }

    if (existing.getValue() !== code) {
      existing.pushEditOperations(
        [],
        [
          {
            range: existing.getFullModelRange(),
            text: code
          }
        ],
        () => null
      );
    }
  }
};

const normalizeVfsPath = (path: string) => {
  const replaced = path.replace(/\\/g, '/');
  const ensured = replaced.startsWith('/') ? replaced : `/${replaced}`;
  return ensured.replace(/\/+/g, '/');
};

const languageFromPath = (path: string) => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.vue')) return 'vue';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.jsx')) return 'javascript';
  return 'typescript';
};
