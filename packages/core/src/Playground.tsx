import React, { useMemo } from 'react';
import { PlaygroundEditor } from './PlaygroundEditor';
import { PlaygroundRender } from './PlaygroundRender';
import { PlaygroundProvider, defaultSnippet } from './PlaygroundProvider';
import type { PlaygroundProps } from './types';

export const Playground: React.FC<PlaygroundProps> = ({
  initialCode = defaultSnippet,
  initialFiles,
  entryFile,
  plugins = [],
  dependencies,
  height = '80vh',
  showFileTree,
  fileTreeDefaultOpen,
  fileTreeWidth,
  mode = 'code',
  formValue,
  onFormValueChange,
  renderForm
}) => {
  const layoutStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'grid',
      gridTemplateColumns: mode === 'form' ? '360px 1fr' : '1fr 1fr',
      gap: '12px',
      height,
      width: '100%'
    }),
    [height, mode]
  );

  return (
    <PlaygroundProvider
      initialCode={initialCode}
      initialFiles={initialFiles}
      entryFile={entryFile}
      plugins={plugins}
      dependencies={dependencies}
      formValue={formValue}
      onFormValueChange={onFormValueChange}
    >
      <div style={layoutStyle}>
        {mode === 'form' ? (
          renderForm ? (
            renderForm({ value: formValue, onChange: onFormValueChange })
          ) : (
            <FormPlaceholder />
          )
        ) : (
          <PlaygroundEditor
            showFileTree={showFileTree}
            fileTreeDefaultOpen={fileTreeDefaultOpen}
            fileTreeWidth={fileTreeWidth}
          />
        )}
        <PlaygroundRender />
      </div>
    </PlaygroundProvider>
  );
};

const FormPlaceholder = () => {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 12,
        background: '#fff',
        color: '#0f172a',
        overflow: 'auto'
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Form mode</div>
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
        Provide <code>renderForm</code> to render your own form UI and pass values via <code>formValue</code>.
      </div>
    </div>
  );
};
