import type { PlaygroundPlugin } from '@browser-playground/core';
import { REACT_TYPE_LIBS } from './bundled/reactTypeLibs';

export type MonacoExtraLib = {
  filePath: string;
  content: string;
};

export type TypesPluginOptions = {
  includeReact?: boolean;
  extraLibs?: MonacoExtraLib[] | Record<string, string>;
  applyToJavaScript?: boolean;
};

export const typesPlugin = (options: TypesPluginOptions = {}): PlaygroundPlugin => {
  const includeReact = options.includeReact ?? true;
  const applyToJavaScript = options.applyToJavaScript ?? true;
  const extraLibs = normalizeExtraLibs(options.extraLibs);

  return {
    name: 'ts-types',
    setupMonaco(monaco: any) {
      const libs: MonacoExtraLib[] = [];
      if (includeReact) libs.push(...reactTypeLibs());
      libs.push(...extraLibs);

      const tsDefaults = monaco.languages.typescript.typescriptDefaults;
      const jsDefaults = monaco.languages.typescript.javascriptDefaults;

      for (const lib of libs) {
        const uri = toMonacoLibUri(lib.filePath);
        tsDefaults.addExtraLib(lib.content, uri);
        if (applyToJavaScript) {
          jsDefaults.addExtraLib(lib.content, uri);
        }
      }
    }
  };
};

const normalizeExtraLibs = (input: TypesPluginOptions['extraLibs']): MonacoExtraLib[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.entries(input).map(([filePath, content]) => ({ filePath, content }));
};

const toMonacoLibUri = (filePath: string) => {
  const normalized = filePath.startsWith('file://') ? filePath : `file:///node_modules/${filePath.replace(/^\/+/, '')}`;
  return normalized;
};

const reactTypeLibs = (): MonacoExtraLib[] => {
  return REACT_TYPE_LIBS.map((l) => ({ filePath: l.filePath, content: l.content }));
};
