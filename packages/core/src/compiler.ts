import * as Babel from '@babel/standalone';
import { rollup } from '@rollup/browser';
import { extendCompileConfigWithDependencies } from './dependencies';
import type { CompileResult, PlaygroundCompileConfig, PlaygroundPlugin, VirtualFileSystem } from './types';

const defaultBabelPlugins: any[] = [];

const babelTransform = (code: string, filename = 'UserComponent.tsx') => {
  const result = Babel.transform(code, {
    filename,
    presets: [
      ['env', { modules: false, targets: { esmodules: true } }],
      'typescript',
      ['react', { runtime: 'classic' }]
    ],
    parserOpts: {
      plugins: defaultBabelPlugins
    }
  });

  return result.code ?? '';
};

export async function compileUserCode(
  rawCode: string,
  plugins: PlaygroundPlugin[] = []
): Promise<CompileResult> {
  return compileVirtualFiles({ '/UserPreview.tsx': rawCode }, '/UserPreview.tsx', plugins);
}

export async function compileVirtualFiles(
  rawFiles: VirtualFileSystem,
  entryFile: string,
  plugins: PlaygroundPlugin[] = [],
  options?: { dependencies?: string[] }
): Promise<CompileResult> {
  let files = normalizeVirtualFileSystem(rawFiles);
  let entry = normalizeVfsPath(entryFile);

  if (!files[entry]) {
    const first = Object.keys(files)[0];
    return { code: null, error: `Entry file not found: "${entry}". Available files: ${first ? `"${first}"...` : '(none)'}` };
  }

  try {
    for (const plugin of plugins) {
      if (!plugin.transformVirtualFiles) continue;
      const transformed = await plugin.transformVirtualFiles({ files, entryFile: entry });
      if (!transformed) continue;
      files = normalizeVirtualFileSystem(transformed.files);
      entry = normalizeVfsPath(transformed.entryFile);
    }
  } catch (error) {
    return { code: null, error: formatError(error) };
  }

  if (!files[entry]) {
    return { code: null, error: `Entry file not found after plugin transforms: "${entry}".` };
  }

  const compileConfigBase = resolveCompileConfig(plugins, { files, entryFile: entry });
  const compileConfig = extendCompileConfigWithDependencies(compileConfigBase, options?.dependencies ?? []);

  let workingFiles: VirtualFileSystem = { ...files };

  try {
    for (const plugin of plugins) {
      if (!plugin.beforeCompile) continue;
      const next: VirtualFileSystem = {};
      for (const [path, code] of Object.entries(workingFiles)) {
        next[path] = await plugin.beforeCompile(code);
      }
      workingFiles = next;
    }
  } catch (error) {
    return { code: null, error: formatError(error) };
  }

  let bundled: string;
  try {
    bundled = await bundleVirtualFilesWithRollup(workingFiles, entry, compileConfig);
  } catch (error) {
    return { code: null, error: formatError(error) };
  }

  const wrapped = wrapIifeExecutable(bundled, compileConfig.iifeName);
  let result: CompileResult = {
    code: wrapped,
    error: null,
    runtime: compileConfig.runtime,
    runtimeGlobalNames: Array.from(new Set(Object.values(compileConfig.rollupGlobals)))
  };

  try {
    for (const plugin of plugins) {
      if (plugin.afterCompile) {
        result = await plugin.afterCompile(result);
      }
    }
  } catch (error) {
    return { code: null, error: formatError(error) };
  }

  return result;
}

export async function bundleWithRollup(source: string) {
  const code = await bundleVirtualFilesWithRollup({ '/entry.tsx': source }, '/entry.tsx', defaultReactCompileConfig());
  return code;
}

const wrapIifeExecutable = (bundledCode: string, globalName: string) => {
  return `${bundledCode}
const __playground_export__ =
  typeof ${globalName} !== 'undefined' && ${globalName} && (${globalName}.default ?? ${globalName});
return __playground_export__;`;
};

const bundleVirtualFilesWithRollup = async (files: VirtualFileSystem, entryFile: string, config: PlaygroundCompileConfig) => {
  const bundle = await rollup({
    input: entryFile,
    external: config.rollupExternal,
    plugins: [
      {
        name: 'virtual-fs',
        resolveId(source, importer) {
          if (config.allowedBareImports.includes(source)) return null;

          const importerPath = importer ? stripQuery(importer) : null;

          if (!importerPath && source === entryFile) {
            return source;
          }

          if (source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) {
            const resolved = resolveVfsImport(source, importerPath ?? entryFile, files);
            if (!resolved) {
              throw new Error(
                `Cannot resolve import "${source}" from "${importerPath ?? '(entry)'}".`
              );
            }
            return resolved;
          }

          throw new Error(
            `Only relative/absolute imports are supported in this sandbox; tried to import "${source}".`
          );
        },
        load(id) {
          const path = stripQuery(id);
          if (files[path] == null) return null;
          return files[path];
        },
        transform(code, id) {
          const path = stripQuery(id);
          if (files[path] == null) return null;
          const compiled = babelTransform(code, path);
          return { code: compiled, map: null };
        }
      }
    ]
  });

  const { output } = await bundle.generate({
    format: 'iife',
    name: config.iifeName,
    globals: config.rollupGlobals
  });

  await bundle.close();
  return output[0]?.code ?? '';
};

const stripQuery = (id: string) => id.split('?')[0] ?? id;

const normalizeVirtualFileSystem = (files: VirtualFileSystem): VirtualFileSystem => {
  const normalized: VirtualFileSystem = {};
  for (const [path, code] of Object.entries(files)) {
    normalized[normalizeVfsPath(path)] = code;
  }
  return normalized;
};

const normalizeVfsPath = (path: string) => {
  const replaced = path.replace(/\\/g, '/');
  const ensured = replaced.startsWith('/') ? replaced : `/${replaced}`;
  return ensured.replace(/\/+/g, '/');
};

const resolveVfsImport = (source: string, importer: string, files: VirtualFileSystem) => {
  const baseDir = dirname(importer);
  const baseResolved = source.startsWith('/') ? normalizeVfsPath(source) : normalizeVfsPath(resolvePath(baseDir, source));

  const candidates = fileCandidates(baseResolved);
  for (const candidate of candidates) {
    if (files[candidate] != null) return candidate;
  }
  return null;
};

const fileCandidates = (path: string) => {
  const hasExt = /\.[a-zA-Z0-9]+$/.test(path);
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
  const candidates: string[] = [];

  if (hasExt) {
    candidates.push(path);
    return candidates;
  }

  for (const ext of exts) candidates.push(`${path}${ext}`);
  for (const ext of exts) candidates.push(`${path}/index${ext}`);
  return candidates;
};

const dirname = (path: string) => {
  const normalized = normalizeVfsPath(path);
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '/';
  return normalized.slice(0, idx);
};

const resolvePath = (baseDir: string, relative: string) => {
  const baseParts = normalizeVfsPath(baseDir).split('/').filter(Boolean);
  const relParts = relative.split('/').filter(Boolean);
  const parts = [...baseParts];

  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return `/${parts.join('/')}`;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown error';
};

const defaultReactCompileConfig = (): PlaygroundCompileConfig => ({
  runtime: 'react',
  allowedBareImports: ['react'],
  rollupExternal: ['react'],
  rollupGlobals: { react: 'React' },
  iifeName: '__PlaygroundPreview__'
});

const resolveCompileConfig = (
  plugins: PlaygroundPlugin[],
  ctx: { files: VirtualFileSystem; entryFile: string }
): PlaygroundCompileConfig => {
  let config = defaultReactCompileConfig();
  for (const plugin of plugins) {
    if (!plugin.extendCompileConfig) continue;
    config = plugin.extendCompileConfig(config, ctx) ?? config;
  }
  return config;
};
