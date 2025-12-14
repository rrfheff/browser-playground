import './runtimePolyfills';
import type { VirtualFileSystem } from './types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type * as t from '@babel/types';

export type MappingPath = Array<string | number>;

export type MappingDescriptor = {
  filePath: string;
  path: MappingPath;
  initRange: { start: number; end: number };
  initValue: unknown;
  quoteHint?: "'" | '"' | '`';
};

const PARSER_PLUGINS: any[] = ['typescript', 'jsx'];
const MAPPING_TAG = '@pg-mapping';

export function applyFormValueToFiles(files: VirtualFileSystem, formValue: unknown): VirtualFileSystem {
  const next: VirtualFileSystem = {};
  for (const [filePath, code] of Object.entries(files)) {
    next[filePath] = applyFormValueToCode(code, formValue);
  }
  return next;
}

export function applyFormValueToCode(code: string, formValue: unknown): string {
  const mappings = extractMappingsFromCode(code, '/__inline__');
  if (mappings.length === 0) return code;

  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const mapping of mappings) {
    const value = getByPath(formValue, mapping.path);
    if (value === undefined) continue;
    const text = literalToSource(value, mapping.quoteHint);
    if (text == null) continue;
    replacements.push({ start: mapping.initRange.start, end: mapping.initRange.end, text });
  }

  if (replacements.length === 0) return code;
  replacements.sort((a, b) => b.start - a.start);

  let out = code;
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  return out;
}

export function extractMappedFormValue(files: VirtualFileSystem): unknown {
  const out: any = {};

  for (const [filePath, code] of Object.entries(files)) {
    const mappings = extractMappingsFromCode(code, filePath);
    for (const mapping of mappings) {
      if (mapping.initValue === undefined) continue;
      setByPath(out, mapping.path, mapping.initValue);
    }
  }

  return out;
}

export function extractMappingsFromCode(code: string, filePath: string): MappingDescriptor[] {
  let ast: any;
  try {
    ast = parse(code, { sourceType: 'module', plugins: PARSER_PLUGINS, ranges: true, tokens: true });
  } catch {
    return [];
  }

  const mappings: MappingDescriptor[] = [];

  try {
    (traverse as any)(ast, {
      VariableDeclarator(path: any) {
        const declNode = path.node;
        const parentNode = path.parentPath?.node;
        const comment = findMappingComment(declNode.leadingComments) ?? findMappingComment(parentNode?.leadingComments);
        if (!comment) return;

        const mappingPath = parseMappingPath(comment);
        if (!mappingPath) return;

        const init: t.Expression | null | undefined = declNode.init;
        if (!init || typeof init.start !== 'number' || typeof init.end !== 'number') return;

        const { value, quoteHint } = extractLiteralValueWithHint(code, init);
        if (value === undefined) return;

        mappings.push({
          filePath,
          path: mappingPath,
          initRange: { start: init.start, end: init.end },
          initValue: value,
          quoteHint
        });
      }
    });
  } catch {
    return [];
  }

  return mappings;
}

const findMappingComment = (comments: any[] | null | undefined) => {
  if (!comments || comments.length === 0) return null;
  for (const c of comments) {
    const value: string | undefined = c?.value;
    if (!value) continue;
    if (value.includes(MAPPING_TAG)) return value;
  }
  return null;
};

const parseMappingPath = (commentValue: string): MappingPath | null => {
  const idx = commentValue.indexOf(MAPPING_TAG);
  if (idx < 0) return null;
  const after = commentValue.slice(idx + MAPPING_TAG.length).trim();
  const start = after.indexOf('[');
  const end = after.lastIndexOf(']');
  if (start < 0 || end < 0 || end <= start) return null;

  const inside = after.slice(start, end + 1).trim();
  try {
    // Supports: ['a','b'] or ["a","b"] or [0,"a"].
    const jsonish = inside.replace(/'/g, '"');
    const parsed = JSON.parse(jsonish);
    if (!Array.isArray(parsed)) return null;
    const path: MappingPath = [];
    for (const seg of parsed) {
      if (typeof seg === 'string' || typeof seg === 'number') path.push(seg);
      else return null;
    }
    return path;
  } catch {
    return null;
  }
};

const extractLiteralValueWithHint = (code: string, initNode: any): { value: unknown; quoteHint?: "'" | '"' | '`' } => {
  if (initNode?.type === 'StringLiteral') {
    const hint = quoteHintFromSource(code.slice(initNode.start, initNode.end));
    return { value: initNode.value, quoteHint: hint };
  }
  if (initNode?.type === 'NumericLiteral') return { value: initNode.value };
  if (initNode?.type === 'BooleanLiteral') return { value: initNode.value };
  if (initNode?.type === 'NullLiteral') return { value: null };
  if (initNode?.type === 'TemplateLiteral' && Array.isArray(initNode.expressions) && initNode.expressions.length === 0) {
    return { value: initNode.quasis?.[0]?.value?.cooked ?? '', quoteHint: '`' };
  }
  return { value: undefined };
};

const quoteHintFromSource = (raw: string): "'" | '"' | '`' | undefined => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("'")) return "'";
  if (trimmed.startsWith('"')) return '"';
  if (trimmed.startsWith('`')) return '`';
  return undefined;
};

const literalToSource = (value: unknown, quoteHint?: "'" | '"' | '`'): string | null => {
  if (value == null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value !== 'string') return null;

  if (quoteHint === '`') {
    const safe = value.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return `\`${safe}\``;
  }

  if (quoteHint === "'") {
    const safe = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    return `'${safe}'`;
  }

  // Default to double quotes.
  const safe = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${safe}"`;
};

const getByPath = (root: unknown, path: MappingPath): unknown => {
  let cur: any = root;
  for (const seg of path) {
    if (cur == null) return undefined;
    cur = cur[seg as any];
  }
  return cur;
};

const setByPath = (root: any, path: MappingPath, value: unknown) => {
  if (!root || path.length === 0) return;
  let cur = root;
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]!;
    const isLast = i === path.length - 1;

    if (isLast) {
      cur[seg as any] = value;
      return;
    }

    const nextSeg = path[i + 1]!;
    const shouldBeArray = typeof nextSeg === 'number';

    if (cur[seg as any] == null || typeof cur[seg as any] !== 'object') {
      cur[seg as any] = shouldBeArray ? [] : {};
    }
    cur = cur[seg as any];
  }
};
