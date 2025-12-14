import React, { useMemo, useState } from 'react';
import { Playground } from '@browser-playground/core';
import { injectReactImportPlugin, loggerPlugin } from '@browser-playground/plugins';
import { vuePlugin } from '@browser-playground/vue';

const heroStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: 20
};

const App: React.FC = () => {
  const [example, setExample] = useState<'react-mapping' | 'react-basic' | 'vue-sfc'>('react-mapping');
  const [mode, setMode] = useState<'code' | 'form'>('form');
  const [formValue, setFormValue] = useState<any>({
    info: { title: 'Browser Playground', name: 'Playground' },
    ui: { accent: '#0f172a' }
  });

  const reactFiles = useMemo(
    () => ({
      '/src/App.tsx': `import React from 'react';
import { Card } from './components/Card';
import { NAMES } from './data/names';

// @pg-mapping ['info','title']
const title = 'Browser Playground';

export default function Preview() {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 8 }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {NAMES.map((name) => (
        <Card key={name} name={name} />
      ))}
    </div>
  );
}
`,
      '/src/components/Card.tsx': `import React from 'react';

// @pg-mapping ['info','name']
const label = 'Playground';

// @pg-mapping ['ui','accent']
const accent = '#0f172a';

type CardProps = { name: string };

export const Card: React.FC<CardProps> = ({ name }) => {
  return (
    <div style={{ padding: '16px', borderRadius: '12px', background: accent, color: '#e2e8f0' }}>
      <h3 style={{ margin: 0 }}>{label}: {name}</h3>
      <p style={{ marginTop: 8 }}>Edit the form to update code, or edit code to update the form.</p>
    </div>
  );
};
`,
      '/src/data/names.ts': `export const NAMES = ['React', 'Rollup', 'Monaco'];\n`
    }),
    []
  );

  const vueFiles = useMemo(
    () => ({
      '/src/App.vue': `<template>
  <div style="display: grid; gap: 12px; padding: 8px;">
    <h2 style="margin: 0;">{{ title }}</h2>
    <div v-for="n in names" :key="n" style="padding: 16px; border-radius: 12px; background: #0f172a; color: #e2e8f0;">
      Hello, {{ n }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: 'Vue Playground',
      names: ['Vue', 'SFC', 'Compiler']
    };
  }
}
</script>
`
    }),
    []
  );

  const selection = useMemo(() => {
    if (example === 'vue-sfc') {
      return {
        entryFile: '/src/App.vue',
        initialFiles: vueFiles,
        plugins: [vuePlugin()],
        supportsForm: false,
        pluginBadges: ['vue-runtime']
      } as const;
    }

    if (example === 'react-basic') {
      return {
        entryFile: '/src/App.tsx',
        initialFiles: {
          '/src/App.tsx': `export default function Preview() {\n  return <div style={{ padding: 8 }}>Hello React</div>;\n}\n`
        },
        plugins: [injectReactImportPlugin(), loggerPlugin()],
        supportsForm: false,
        pluginBadges: ['inject-react-import', 'logger']
      } as const;
    }

    return {
      entryFile: '/src/App.tsx',
      initialFiles: reactFiles,
      plugins: [injectReactImportPlugin(), loggerPlugin()],
      supportsForm: true,
      pluginBadges: ['inject-react-import', 'logger']
    } as const;
  }, [example, reactFiles, vueFiles]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={heroStyle}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>Browser Playground</div>
          <p style={{ maxWidth: 640, lineHeight: 1.4 }}>
            Live-edit React code with Monaco, instant Babel/rollup-browser compilation, and a sandboxed renderer.
          </p>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' }}>
          <div style={{ fontSize: 12, color: '#475569' }}>Plugins loaded</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {selection.pluginBadges.map((b) => (
              <Badge key={b}>{b}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#475569' }}>Example</div>
        <select
          value={example}
          onChange={(e) => {
            const next = e.target.value as any;
            setExample(next);
            setMode(next === 'react-mapping' ? 'form' : 'code');
          }}
          style={selectStyle}
        >
          <option value="react-mapping">React + Form mapping</option>
          <option value="react-basic">React basic</option>
          <option value="vue-sfc">Vue SFC</option>
        </select>

        {selection.supportsForm && (
          <>
            <div style={{ width: 1, height: 18, background: '#cbd5e1' }} />
            <button type="button" onClick={() => setMode('form')} style={modeBtnStyle(mode === 'form')}>
              Form
            </button>
            <button type="button" onClick={() => setMode('code')} style={modeBtnStyle(mode === 'code')}>
              Code
            </button>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Mapping via <code>// @pg-mapping [...path]</code>
            </div>
          </>
        )}
      </div>

      {selection.supportsForm && mode === 'code' && (
        <div style={{ marginBottom: 12 }}>
          <FormPanel value={formValue} onChange={setFormValue} />
        </div>
      )}

      <Playground
        entryFile={selection.entryFile}
        initialFiles={selection.initialFiles as any}
        plugins={selection.plugins as any}
        height="72vh"
        mode={selection.supportsForm ? mode : 'code'}
        formValue={formValue}
        onFormValueChange={setFormValue}
        renderForm={({ value }) => <FormPanel value={value as any} onChange={setFormValue} />}
      />
    </div>
  );
};

const Badge: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 999,
      background: '#0f172a',
      color: '#e2e8f0',
      fontSize: 12,
      letterSpacing: 0.2
    }}
  >
    {children}
  </span>
);

export default App;

const FormPanel: React.FC<{
  value: any;
  onChange: (next: any) => void;
}> = ({ value, onChange }) => {
  const title = value?.info?.title ?? '';
  const name = value?.info?.name ?? '';
  const accent = value?.ui?.accent ?? '#0f172a';

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Form</div>

      <Label>Title</Label>
      <input
        value={title}
        onChange={(e) => onChange({ ...value, info: { ...(value?.info ?? {}), title: e.target.value } })}
        style={inputStyle}
      />

      <Label>Label</Label>
      <input
        value={name}
        onChange={(e) => onChange({ ...value, info: { ...(value?.info ?? {}), name: e.target.value } })}
        style={inputStyle}
      />

      <Label>Accent</Label>
      <input
        value={accent}
        onChange={(e) => onChange({ ...value, ui: { ...(value?.ui ?? {}), accent: e.target.value } })}
        style={inputStyle}
      />

    </div>
  );
};

const Label: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ fontSize: 12, color: '#475569', marginTop: 10, marginBottom: 6 }}>{children}</div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  fontSize: 14
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  fontSize: 12,
  background: '#fff'
};

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 10,
  border: `1px solid ${active ? '#0f172a' : '#cbd5e1'}`,
  background: active ? '#0f172a' : '#fff',
  color: active ? '#e2e8f0' : '#0f172a',
  cursor: 'pointer',
  fontSize: 12
});
