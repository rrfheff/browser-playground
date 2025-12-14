import type { PlaygroundCompileConfig, PlaygroundPlugin, VirtualFileSystem } from '@browser-playground/core';
import { compileTemplate, parse, rewriteDefault } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { ensureVueMonaco } from './textmate/setupVueMonaco';

type VuePluginOptions = {
  entry?: string;
};

const VUE_ENTRY = '/__playground_vue_entry__.ts';

export const vuePlugin = (options: VuePluginOptions = {}): PlaygroundPlugin => {
  return {
    name: 'vue-runtime',
    setupMonaco(monaco) {
      return ensureVueMonaco(monaco);
    },
    extendCompileConfig(config: PlaygroundCompileConfig) {
      return {
        ...config,
        runtime: 'dom',
        allowedBareImports: ['vue'],
        rollupExternal: ['vue'],
        rollupGlobals: { vue: 'Vue' },
        iifeName: '__PlaygroundPreview__'
      };
    },
    runtimeGlobals() {
      return { Vue };
    },
    transformVirtualFiles: async (ctx: { files: VirtualFileSystem; entryFile: string }) => {
      const entryFile = ctx.entryFile;
      if (!entryFile.toLowerCase().endsWith('.vue')) return null;

      const nextFiles: VirtualFileSystem = { ...ctx.files };
      for (const [path, source] of Object.entries(nextFiles)) {
        if (!path.toLowerCase().endsWith('.vue')) continue;
        nextFiles[path] = compileVueSfcToEsm(source, path);
      }

      const vueEntry = options.entry ?? VUE_ENTRY;
      nextFiles[vueEntry] = createVueEntry(entryFile);
      return { files: nextFiles, entryFile: vueEntry };
    }
  };
};

const createVueEntry = (componentPath: string) => {
  return `import { createApp } from 'vue';
import App from '${componentPath}';

let app;

export default {
  mount(el) {
    app = createApp(App);
    app.mount(el);
  },
  unmount() {
    if (app) app.unmount();
    app = undefined;
  }
};
`;
};

const compileVueSfcToEsm = (source: string, filename: string) => {
  const { descriptor, errors } = parse(source, { filename });
  if (errors && errors.length) {
    const msg = errors.map((e: any) => (typeof e === 'string' ? e : e.message)).join('\\n');
    throw new Error(msg);
  }

  const script = descriptor.script?.content ?? 'export default {}';
  const rewritten = rewriteDefault(script, '__sfc__', ['typescript', 'jsx']);

  const templateBlock = descriptor.template;
  const templateResult = templateBlock
    ? compileTemplate({
        source: templateBlock.content,
        filename,
        id: hashId(filename),
        // Module mode generates valid ESM output that Rollup can bundle.
        compilerOptions: { mode: 'module' }
      })
    : null;

  if (templateResult && (templateResult as any).errors?.length) {
    const msg = (templateResult as any).errors.map((e: any) => (typeof e === 'string' ? e : e.message)).join('\\n');
    throw new Error(msg);
  }

  const templateCode = templateResult ? (templateResult as any).code : 'export function render() { return null }';

  return `${rewritten}
${templateCode}
__sfc__.render = render;
export default __sfc__;
`;
};

const hashId = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return `pg-${hash.toString(16)}`;
};
