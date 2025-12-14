import type { CompileResult, PlaygroundPlugin } from '@browser-playground/core';

export const loggerPlugin = (): PlaygroundPlugin => ({
  name: 'logger',
  beforeCompile(code) {
    console.info('[playground] compiling code');
    return code;
  },
  afterCompile(result: CompileResult) {
    if (result.error) {
      console.warn('[playground] compile error', result.error);
    }
    return result;
  }
});

export const injectReactImportPlugin = (): PlaygroundPlugin => ({
  name: 'inject-react-import',
  beforeCompile(code) {
    if (code.includes("from 'react'") || code.includes('from "react"')) return code;
    return `import React from 'react';\n${code}`;
  }
});

export type { PlaygroundPlugin } from '@browser-playground/core';
