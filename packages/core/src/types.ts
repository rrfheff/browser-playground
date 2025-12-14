import type React from 'react';

export type VirtualFileSystem = Record<string, string>;

export type PlaygroundMode = 'code' | 'form';

export type PlaygroundRuntime = 'react' | 'dom';

export type PlaygroundPlugin = {
  name: string;
  beforeCompile?: (code: string) => string | Promise<string>;
  afterCompile?: (result: CompileResult) => CompileResult | Promise<CompileResult>;

  setupMonaco?: (monaco: any) => void | Promise<void>;

  transformVirtualFiles?: (ctx: {
    files: VirtualFileSystem;
    entryFile: string;
  }) => { files: VirtualFileSystem; entryFile: string } | null | Promise<{ files: VirtualFileSystem; entryFile: string } | null>;

  extendCompileConfig?: (config: PlaygroundCompileConfig, ctx: { files: VirtualFileSystem; entryFile: string }) => PlaygroundCompileConfig | void;

  runtimeGlobals?: (ctx: { runtime: PlaygroundRuntime }) => Record<string, any> | Promise<Record<string, any>>;
};

export type CompileResult = {
  code: string | null;
  error: string | null;
  runtime?: PlaygroundRuntime;
  runtimeGlobalNames?: string[];
};

export type PlaygroundCompileConfig = {
  runtime: PlaygroundRuntime;
  allowedBareImports: string[];
  rollupExternal: string[];
  rollupGlobals: Record<string, string>;
  iifeName: string;
};

export type PlaygroundProps = {
  initialCode?: string;
  initialFiles?: VirtualFileSystem;
  entryFile?: string;
  plugins?: PlaygroundPlugin[];
  height?: number | string;
  showFileTree?: boolean;
  fileTreeDefaultOpen?: boolean;
  fileTreeWidth?: number | string;
  mode?: PlaygroundMode;
  formValue?: unknown;
  onFormValueChange?: (nextValue: unknown) => void;
  renderForm?: (args: { value: unknown; onChange?: (nextValue: unknown) => void }) => React.ReactNode;
};

export type PlaygroundProviderProps = PlaygroundProps & {
  children: React.ReactNode;
};

export type PlaygroundContextValue = {
  files: VirtualFileSystem;
  activeFilePath: string;
  setActiveFilePath: (path: string) => void;
  updateFile: (path: string, code: string) => void;
  code: string;
  setCode: (value: string) => void;
  isCompiling: boolean;
  error: string | null;
  runtime: PlaygroundRuntime;
  renderedComponent: React.ComponentType | null;
  renderedDomModule: { mount: (el: HTMLElement) => any; unmount?: () => any } | null;
  plugins: PlaygroundPlugin[];
};

export type PlaygroundPaneProps = {
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

export type PlaygroundRenderProps = PlaygroundPaneProps;

export type PlaygroundEditorProps = PlaygroundPaneProps & {
  language?: string;
  showFileTree?: boolean;
  fileTreeDefaultOpen?: boolean;
  fileTreeWidth?: number | string;
};

export type PlaygroundFileTreeProps = PlaygroundPaneProps & {
  width?: number | string;
};
