# Browser Playground

一个在浏览器中进行「在线编辑 + 实时预览」的组件 Playground（Monorepo），核心包是 React 组件，但支持通过插件扩展运行时（例如 Vue）。

## 预览

![截图](./截屏2025-12-14%2023.08.50.png)

录屏演示：[录屏2025-12-14 23.09.32.mov](./录屏2025-12-14%2023.09.32.mov)

## 特性

- Monaco 编辑器（暗色主题）+ 左侧文件树（可折叠）
- 虚拟文件系统（多文件）+ 浏览器端 Rollup 打包
- React 预览（默认）与 DOM 预览运行时（供 Vue 插件使用）
- 插件机制：编译钩子、虚拟文件转换、运行时注入、Monaco 侧扩展
- 表单模式（不内置表单 UI）：通过 `formValue` 驱动渲染；支持 `// @pg-mapping [...]` 双向映射
- Vue 插件：`@browser-playground/vue`（基于 `@vue/compiler-sfc` 编译 SFC 并挂载到预览容器）

## 包结构

- `@browser-playground/core`：Playground 核心（编辑器、文件树、编译与预览）
- `@browser-playground/plugins`：示例插件（logger、自动注入 React import 等）
- `@browser-playground/vue`：Vue 运行时插件（默认不启用）
- `demo`：演示站点（Rspack）

## 快速开始

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

## 使用方式

### React（默认）

```tsx
import { Playground } from '@browser-playground/core';

<Playground />;
```

### 虚拟文件系统（多文件）

```tsx
<Playground
  entryFile="/src/App.tsx"
  initialFiles={{
    '/src/App.tsx': `export default function App(){ return <div>Hello</div> }`,
    '/src/utils.ts': `export const answer = 42;`
  }}
/>;
```

### 表单模式（SDK 不提供表单 UI）

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

### Vue（通过插件启用）

```tsx
import { Playground } from '@browser-playground/core';
import { vuePlugin } from '@browser-playground/vue';

<Playground
  entryFile="/src/App.vue"
  initialFiles={{
    '/src/App.vue': `<template><div>Hello Vue</div></template>\n<script>export default {}</script>`
  }}
  plugins={[vuePlugin()] }
/>;
```

## 安全说明

当前预览使用 `new Function(...)` 执行编译产物，仅适合本地/可信输入的场景。不要把它作为「执行不可信用户代码」的沙箱方案。
