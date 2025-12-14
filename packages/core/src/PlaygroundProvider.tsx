import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { compileVirtualFiles } from './compiler';
import { applyFormValueToFiles, extractMappedFormValue } from './mapping';
import type {
  PlaygroundContextValue,
  PlaygroundPlugin,
  PlaygroundProviderProps,
  PlaygroundRuntime,
  VirtualFileSystem
} from './types';

export const defaultSnippet = `import React from 'react';

type GreetingProps = { name: string };

const Card: React.FC<GreetingProps> = ({ name }) => {
  return (
    <div style={{ padding: '16px', borderRadius: '12px', background: '#0f172a', color: '#e2e8f0' }}>
      <h2 style={{ margin: 0 }}>Hello, {name}</h2>
      <p style={{ marginTop: 8 }}>You can edit this code to see live updates.</p>
    </div>
  );
};

export default function Preview() {
  return (
    <div style={{ display: 'grid', gap: '12px', padding: '8px' }}>
      <Card name="Playground" />
      <Card name="React" />
    </div>
  );
}
`;

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

export const PlaygroundProvider: React.FC<PlaygroundProviderProps> = ({
  initialCode = defaultSnippet,
  initialFiles,
  entryFile = '/App.tsx',
  plugins = [],
  formValue,
  onFormValueChange,
  children
}) => {
  const [files, setFiles] = useState<VirtualFileSystem>(() => {
    if (initialFiles && Object.keys(initialFiles).length > 0) return normalizeVirtualFileSystem(initialFiles);
    return { [normalizeVfsPath(entryFile)]: initialCode };
  });
  const [activeFilePath, setActiveFilePath] = useState(() => {
    const normalizedEntry = normalizeVfsPath(entryFile);
    const normalizedFiles = initialFiles ? normalizeVirtualFileSystem(initialFiles) : null;
    if (normalizedFiles && normalizedFiles[normalizedEntry] != null) return normalizedEntry;
    return normalizedFiles ? Object.keys(normalizedFiles)[0] ?? normalizedEntry : normalizedEntry;
  });
  const [error, setError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [renderedComponent, setRenderedComponent] = useState<React.ComponentType | null>(null);
  const [renderedDomModule, setRenderedDomModule] = useState<{ mount: (el: HTMLElement) => any; unmount?: () => any } | null>(null);
  const [runtime, setRuntime] = useState<PlaygroundRuntime>('react');
  const lastAppliedFormValueRef = React.useRef<unknown>(undefined);
  const lastEmittedFormValueRef = React.useRef<unknown>(undefined);

  useEffect(() => {
    if (initialFiles && Object.keys(initialFiles).length > 0) {
      const normalized = normalizeVirtualFileSystem(initialFiles);
      setFiles(normalized);
      const normalizedEntry = normalizeVfsPath(entryFile);
      setActiveFilePath(normalized[normalizedEntry] != null ? normalizedEntry : Object.keys(normalized)[0] ?? normalizedEntry);
      return;
    }

    const normalizedEntry = normalizeVfsPath(entryFile);
    setFiles({ [normalizedEntry]: initialCode });
    setActiveFilePath(normalizedEntry);
  }, [entryFile, initialCode, initialFiles]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setIsCompiling(true);
      runCompilation(files, normalizeVfsPath(entryFile), plugins).then(async (result) => {
        if (cancelled) return;
        setIsCompiling(false);

        if (result.error || !result.code) {
          setError(result.error ?? 'Unknown compilation error');
          setRenderedComponent(null);
          setRenderedDomModule(null);
          return;
        }

        try {
          const runtimeGlobalNames = result.runtimeGlobalNames ?? ['React'];
          const runtimeGlobals = await resolveRuntimeGlobals(runtimeGlobalNames, plugins, result.runtime ?? 'react');
          if (cancelled) return;
          const createModule = new Function(...runtimeGlobalNames, result.code);
          const moduleExport = createModule(...runtimeGlobals);

          if (result.runtime === 'dom') {
            if (!moduleExport || typeof moduleExport.mount !== 'function') {
              throw new Error('DOM runtime must export an object with a mount(el) function as default export.');
            }
            setRuntime('dom');
            setRenderedDomModule(() => moduleExport);
            setRenderedComponent(null);
            setError(null);
          } else {
            if (moduleExport) {
              setRuntime('react');
              setRenderedComponent(() => moduleExport);
              setRenderedDomModule(null);
              setError(null);
            }
          }
        } catch (err) {
          setError(formatError(err));
          setRenderedComponent(null);
          setRenderedDomModule(null);
        }
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [entryFile, files, plugins]);

  useEffect(() => {
    if (formValue === undefined) return;
    if (isDeepEqual(formValue, lastAppliedFormValueRef.current)) return;
    lastAppliedFormValueRef.current = formValue;

    setFiles((prev) => {
      const next = applyFormValueToFiles(prev, formValue);
      return isDeepEqual(prev, next) ? prev : next;
    });
  }, [formValue]);

  useEffect(() => {
    if (!onFormValueChange) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      const extracted = extractMappedFormValue(files);
      const nextValue = mergeFormValue(formValue, extracted);
      if (isDeepEqual(nextValue, formValue)) return;
      if (isDeepEqual(nextValue, lastEmittedFormValueRef.current)) return;
      lastEmittedFormValueRef.current = nextValue;
      onFormValueChange(nextValue);
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [files, formValue, onFormValueChange]);

  const updateFile = (path: string, code: string) => {
    const normalized = normalizeVfsPath(path);
    setFiles((prev) => ({ ...prev, [normalized]: code }));
  };

  const code = files[normalizeVfsPath(activeFilePath)] ?? '';
  const setCode = (value: string) => updateFile(activeFilePath, value);

  const value = useMemo<PlaygroundContextValue>(
    () => ({
      files,
      activeFilePath,
      setActiveFilePath: (path: string) => setActiveFilePath(normalizeVfsPath(path)),
      updateFile,
      code,
      setCode,
      isCompiling,
      error,
      runtime,
      renderedComponent,
      renderedDomModule,
      plugins
    }),
    [activeFilePath, code, error, files, isCompiling, plugins, renderedComponent, renderedDomModule, runtime]
  );

  return <PlaygroundContext.Provider value={value}>{children}</PlaygroundContext.Provider>;
};

export const usePlayground = () => {
  const ctx = useContext(PlaygroundContext);
  if (!ctx) {
    throw new Error('usePlayground must be used within a PlaygroundProvider');
  }
  return ctx;
};

const runCompilation = async (files: VirtualFileSystem, entryFile: string, plugins: PlaygroundPlugin[]) => {
  const result = await compileVirtualFiles(files, entryFile, plugins);
  return result;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown runtime error';
};

const normalizeVirtualFileSystem = (rawFiles: VirtualFileSystem): VirtualFileSystem => {
  const normalized: VirtualFileSystem = {};
  for (const [path, code] of Object.entries(rawFiles)) {
    normalized[normalizeVfsPath(path)] = code;
  }
  return normalized;
};

const normalizeVfsPath = (path: string) => {
  const replaced = path.replace(/\\/g, '/');
  const ensured = replaced.startsWith('/') ? replaced : `/${replaced}`;
  return ensured.replace(/\/+/g, '/');
};

const resolveRuntimeGlobals = async (names: string[], plugins: PlaygroundPlugin[], runtime: PlaygroundRuntime) => {
  const globals: Record<string, any> = { React };

  for (const plugin of plugins) {
    if (!plugin.runtimeGlobals) continue;
    const provided = await plugin.runtimeGlobals({ runtime });
    Object.assign(globals, provided ?? {});
  }

  return names.map((n) => globals[n]);
};

const mergeFormValue = (base: unknown, overlay: unknown): unknown => {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  return deepMergeObjects(base as Record<string, any>, overlay as Record<string, any>);
};

const deepMergeObjects = (base: Record<string, any>, overlay: Record<string, any>) => {
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    const baseValue = out[k];
    if (isPlainObject(baseValue) && isPlainObject(v)) {
      out[k] = deepMergeObjects(baseValue, v);
    } else {
      out[k] = v;
    }
  }
  return out;
};

const isPlainObject = (value: unknown): value is Record<string, any> => {
  if (value == null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isDeepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!isDeepEqual(a[k], b[k])) return false;
  }
  return true;
};
