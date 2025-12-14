# Browser Playground

An in-browser code playground with Monaco editing, a virtual file system, and live preview.

[中文文档](README.zh-CN.md)

## Preview

![Screenshot](./demo.png)

Video demo: [demo.mov](./demo.mov)

## Features

- Monaco editor (dark theme) + collapsible file explorer
- Virtual file system (multi-file) + in-browser bundling via Rollup
- Preview runtimes:
  - React runtime (default)
  - DOM runtime (used by the Vue plugin)
- Plugin system:
  - `beforeCompile` / `afterCompile`
  - `transformVirtualFiles` (e.g. compile `.vue` into JS)
  - `extendCompileConfig` (runtime / externals / globals)
  - `setupMonaco` (register languages, etc.)
- Form mode (SDK does not provide any form UI):
  - `formValue` drives preview
  - two-way mapping via `// @pg-mapping ['path','to','value']`
- Vue support via plugin package `@browser-playground/plugin-vue` (opt-in)

## Packages

- `@browser-playground/core`: React components (Playground / Provider / Editor / Render), compiler/bundler, plugin hooks.
- `@browser-playground/plugin-controller`: example plugins (logger, auto React import).
- `@browser-playground/plugin-types`: Monaco TypeScript typings injector (React types, plus custom extra libs).
- `@browser-playground/plugin-vue`: Vue runtime plugin (compiles SFC with `@vue/compiler-sfc` and mounts to the preview container).
- `demo`: Rspack-powered demo site.

## Quick Start

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

## Usage

### React (default)

```tsx
import { Playground } from '@browser-playground/core';

<Playground />;
```

### Virtual file system (multi-file)

```tsx
<Playground
  entryFile="/src/App.tsx"
  initialFiles={{
    '/src/App.tsx': `export default function App(){ return <div>Hello</div> }`,
    '/src/utils.ts': `export const answer = 42;`
  }}
/>;
```

### Form mode (SDK does not render form controls)

```tsx
const [formValue, setFormValue] = useState({ info: { name: 'jack' } });

<Playground
  mode="form"
  formValue={formValue}
  onFormValueChange={setFormValue}
  renderForm={({ value, onChange }) => (
    <input
      value={(value as any)?.info?.name ?? ''}
      onChange={(e) =>
        onChange?.({ ...(value as any), info: { ...(value as any)?.info, name: e.target.value } })
      }
    />
  )}
  entryFile="/src/App.tsx"
  initialFiles={{
    '/src/App.tsx': `// @pg-mapping ['info','name']\nconst name = 'jack';\nexport default function App(){ return <div>Hello {name}</div>; }`
  }}
/>;
```

### Vue (opt-in plugin)

```tsx
import { Playground } from '@browser-playground/core';
import { vuePlugin } from '@browser-playground/plugin-vue';

<Playground
  entryFile="/src/App.vue"
  initialFiles={{
    '/src/App.vue': `<template><div>Hello Vue</div></template>\n<script>export default {}</script>`
  }}
  plugins={[vuePlugin()]}
/>;
```

### TypeScript typings in Monaco (opt-in plugin)

Monaco does not ship React/JSX typings by default. Use `@browser-playground/plugin-types` to register `.d.ts` as extra libs.

```tsx
import { typesPlugin } from '@browser-playground/plugin-types';

<Playground plugins={[typesPlugin()]} />;
```

### Inject third-party dependencies (host-provided)

If the host app already installed a package, you can pass it to the playground and import it in user code.

```tsx
import dayjs from 'dayjs';

<Playground
  dependencies={{ dayjs }}
  entryFile="/src/App.tsx"
  initialFiles={{
    '/src/App.tsx': `import dayjs from 'dayjs';\nexport default function App(){ return <div>{dayjs().format('YYYY-MM-DD')}</div> }`
  }}
/>;
```

## Security

The preview currently executes compiled output via `new Function(...)`. This is suitable for trusted/local code only. Do not use this as a sandbox for untrusted users.
