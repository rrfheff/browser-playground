import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { INITIAL, parseRawGrammar, Registry } from 'vscode-textmate';
import { ONIG_WASM_BASE64 } from './onigWasmBase64';

import vueGrammar from './grammars/vue.tmLanguage.json';
import htmlGrammar from './grammars/html.tmLanguage.json';
import cssGrammar from './grammars/css.tmLanguage.json';
import jsGrammar from './grammars/JavaScript.tmLanguage.json';
import jsxGrammar from './grammars/JavaScriptReact.tmLanguage.json';
import tsGrammar from './grammars/TypeScript.tmLanguage.json';
import tsxGrammar from './grammars/TypeScriptReact.tmLanguage.json';

let setupPromise: Promise<void> | null = null;

export const ensureVueMonaco = (monacoNs: any) => {
  if (setupPromise) return setupPromise;
  setupPromise = setup(monacoNs);
  return setupPromise;
};

const setup = async (monacoNs: any) => {
  registerVueLanguage(monacoNs);

  await loadWASM(decodeBase64ToUint8Array(ONIG_WASM_BASE64));

  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner(patterns: string[]) {
        return new OnigScanner(patterns);
      },
      createOnigString(s: string) {
        return new OnigString(s);
      }
    }),
    loadGrammar: async (scopeName: string) => {
      const grammar = scopeToGrammarJson(scopeName);
      if (!grammar) return null;
      return parseRawGrammar(JSON.stringify(grammar), `${scopeName}.tmLanguage.json`);
    }
  });

  const vue = await registry.loadGrammar('text.html.vue');
  if (!vue) return;

  monacoNs.languages.setTokensProvider('vue', {
    getInitialState: () => new TokenizerState(INITIAL),
    tokenize: (line: string, state: any) => {
      const res = vue.tokenizeLine(line, state.ruleStack);
      return {
        endState: new TokenizerState(res.ruleStack),
        tokens: res.tokens.map((t: any) => ({
          ...t,
          scopes: mapScopesToMonacoToken(t.scopes)
        }))
      };
    }
  });
};

const registerVueLanguage = (monacoNs: any) => {
  const languages: any[] = (monacoNs.languages.getLanguages?.() ?? []) as any[];
  if (languages.some((l) => l.id === 'vue')) return;
  monacoNs.languages.register({
    id: 'vue',
    extensions: ['.vue'],
    aliases: ['Vue', 'vue']
  });
};

class TokenizerState {
  constructor(public readonly ruleStack: any) {}
  clone() {
    return new TokenizerState(this.ruleStack);
  }
  equals(other: any) {
    return other instanceof TokenizerState && other.ruleStack === this.ruleStack;
  }
}

const scopeToGrammarJson = (scopeName: string): any | null => {
  switch (scopeName) {
    case 'text.html.vue':
      return vueGrammar;
    case 'text.html.basic':
      return htmlGrammar;
    case 'source.css':
      return cssGrammar;
    case 'source.js':
      return jsGrammar;
    case 'source.js.jsx':
      return jsxGrammar;
    case 'source.ts':
      return tsGrammar;
    case 'source.tsx':
      return tsxGrammar;
    default:
      return null;
  }
};

const mapScopesToMonacoToken = (scopes: string[]) => {
  const scope = (scopes[scopes.length - 1] ?? '').toLowerCase();
  if (!scope) return '';

  if (scope.includes('comment')) return 'comment';
  if (scope.includes('string')) return 'string';
  if (scope.includes('constant.numeric') || scope.includes('number')) return 'number';
  if (scope.includes('keyword')) return 'keyword';

  if (scope.includes('entity.name.tag') || scope.includes('tag')) return 'tag';
  if (scope.includes('entity.other.attribute-name') || scope.includes('attribute.name')) return 'attribute.name';
  if (scope.includes('attribute.value')) return 'attribute.value';

  if (scope.includes('punctuation')) return 'delimiter';
  return '';
};

function decodeBase64ToUint8Array(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
