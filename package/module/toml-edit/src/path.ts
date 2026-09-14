/**
 Path utilities.
 
 @module
 */

import type { AST, } from 'toml-eslint-parser';

import type { TomlPath, } from './types.ts';

/**
 Read-only key spelling, excluding parser locations and parent links that path comparison never consumes.

 @example
 ```ts
 const segment: KeySegmentView = { type: 'TOMLBare', name: 'server' };
 ```
 */
type KeySegmentView = {
  readonly type: AST.TOMLBare['type'];
  readonly name: AST.TOMLBare['name'];
} | {
  readonly type: AST.TOMLQuoted['type'];
  readonly value: AST.TOMLQuoted['value'];
};

/**
 Ordered key segments are sufficient for path lookup without exposing writable parser structure.

 @example
 ```ts
 const key: KeyView = { keys: [{ type: 'TOMLBare', name: 'server' }] };
 ```
 */
type KeyView = {
  readonly keys: readonly KeySegmentView[];
};

/**
 Surface the string form of a key fragment.
 
 `TOMLBare` carries the identifier as `name`; `TOMLQuoted` carries the
 decoded string as `value`. Both are surfaced as the same string here so
 path comparisons treat `key = 1` and `"key" = 1` identically.
 
 @returns Computed string.
 
 @example
 ```ts
 keyNameOf({ key: { type: 'TOMLBare', name: 'foo' }, },); // 'foo'
 ```
 */
export function keyNameOf({ key, }: { readonly key: KeySegmentView; },): string {
  return key.type
    === 'TOMLBare' ? key.name : key.value;
}

/**
 The full list of segments that a `TOMLKey` spells.
 
 Dotted-key forms like `a.b.c = 1` produce three segments.
 
 @returns Computed result (`readonly string[]`).
 
 @example
 ```ts
 keysOf({ key: tomlKeyForABC, },); // ['a', 'b', 'c']
 ```
 */
export function keysOf({ key, }: { readonly key: KeyView; },): readonly string[] {
  return key.keys
    .map(function nameOf(k: KeySegmentView,) {
    return keyNameOf({ key: k, },);
  },);
}

/**
 Render a `TomlPath` as a human-readable string for error messages.
 
 @returns Computed string.
 
 @example
 ```ts
 formatPath({ path: ['fruits', 0, 'name'] as const, },); // 'fruits[0].name'
 ```
 */
export function formatPath({ path, }: { readonly path: TomlPath; },): string {
  return path
    .map(function fmt(
      seg,
      i,
    ) {
      if ((typeof seg) === 'number')
        return `[${String(seg,)}]`;
      if (i === 0)
        return seg;
      return `.${seg}`;
    },)
    .join('',);
}

/**
 True when a path segment matches a TOML key string (bare or quoted).
 
 @returns Resulting boolean.
 
 @example
 ```ts
 keyMatchesSegment({ keyName: 'foo', segment: 'foo', },); // true
 keyMatchesSegment({ keyName: 'foo', segment: 0, },);     // false
 ```
 */
export function keyMatchesSegment(
  {
    keyName,
    segment,
  }: {
    readonly keyName: string;
    readonly segment: string | number;
  },
): boolean {
  return ((typeof segment) === 'string') && (segment === keyName);
}
