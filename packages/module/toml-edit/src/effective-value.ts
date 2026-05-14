/**
 * Effective-value lookups: route every read through this helper so pending
 * edits (set/delete) are reflected on the same state and on any branched
 * state derived from it.
 *
 * Resolution policy:
 *
 * 1. Exact-path pending insertion match.
 * 2. Longest-prefix-first walk: at each prefix, look for a pending
 *    insertion at that path, or a pending edit on the AST node
 *    `resolveByPath` returns. Most-specific covers least-specific.
 * 3. Sub-tree synthesis: collect every pending insertion whose path
 *    strictly extends the query path and merge their JS values into a
 *    fresh object.
 * 4. AST fallback: existing keyvalue/table/AOT deletion detection plus
 *    the `replace-value` jsValue surface.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import {
  resolveByPath,
  type ResolveResult,
} from './resolve.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';
import { isPlainObject, } from './values.ts';

/**
 * Resolution result reflecting pending deltas.
 *
 * `'deleted'` is returned when the path was deleted by a pending
 * `tomlDelete`. `'pending-value'` is returned when the path was set by a
 * pending `tomlSet` (or computed via cross-path projection); `value` is
 * the effective JS value.
 */
export type EffectiveResult =
  | { readonly kind: 'deleted'; }
  | { readonly kind: 'pending-value'; readonly value: unknown; }
  | ResolveResult;

/**
 * Resolve a path against the AST plus pending deltas.
 *
 * @example
 * ```ts
 * effectiveAt({ edit, path: ['arr', 1,] },);  // returns 30 after tomlDelete(['arr', 1])
 * ```
 */
export function effectiveAt(
  { edit, path, }: { edit: TomlEditState; path: TomlPath; },
): EffectiveResult {
  const exactInsertion = edit.insertions.find(function matchesPath(ins,) {
    return ins.path !== undefined && pathEquals({ a: ins.path, b: path, },);
  },);
  if (exactInsertion !== undefined)
    return { kind: 'pending-value', value: exactInsertion.jsValue, };

  const prefixProjection = projectPendingAtPrefix({ edit, path, },);
  if (prefixProjection !== null)
    return prefixProjection;

  const subtree = synthesiseSubtree({ edit, path, },);
  if (subtree !== null)
    return { kind: 'pending-value', value: subtree, };

  return resolveAst({ edit, path, },);
}

/**
 * Synthetic `missing` placeholder for JS-space dead-ends. Uses the
 * program's top-level table as a non-null `deepest` sentinel; consumers
 * only read `kind` from the missing arm.
 */
function missingFor(
  { edit, }: { edit: TomlEditState; },
): ResolveResult {
  return {
    kind: 'missing',
    deepest: edit.program.body[0],
    consumed: 0,
  };
}

/**
 * Walk `path` longest-prefix-first looking for any pending state that
 * covers the prefix; navigate the JS value space for the remaining
 * segments.
 *
 * Returns `null` when no covering pending state exists.
 */
function projectPendingAtPrefix(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath;
  },
): EffectiveResult | null {
  for (let prefixLen = path.length; prefixLen >= 1; prefixLen--) {
    const prefix = path.slice(0, prefixLen,);
    const rest = path.slice(prefixLen,);

    const matchingIns = edit.insertions.find(function matches(ins,) {
      return ins.path !== undefined && pathEquals({ a: ins.path, b: prefix, },);
    },);
    if (matchingIns !== undefined)
      return navigateJsValue({ edit, value: matchingIns.jsValue, rest, },);

    const baseAtPrefix = resolveByPath({ edit, path: prefix, },);
    const pendingNode = nodeFromResolved({ resolved: baseAtPrefix, },);
    if (pendingNode !== null) {
      if (edit.deletions.has(pendingNode,))
        return { kind: 'deleted', };
      const pendingEdit = edit.edits.get(pendingNode,);
      if (pendingEdit !== undefined && pendingEdit.jsValue !== undefined)
        return navigateJsValue({ edit, value: pendingEdit.jsValue, rest, },);
    }
  }
  return null;
}

/**
 * Extract the AST node a pending edit could be keyed on.
 *
 * For `keyvalue`, this is the key-value node (the splice engine uses
 * its `value.range`). For `value`, this is the content node directly
 * (used by element-Edit cases). Other kinds either have no single node
 * to edit or are handled in the AST fallback.
 */
function nodeFromResolved(
  { resolved, }: { resolved: ResolveResult; },
): AST.TOMLNode | null {
  if (resolved.kind === 'keyvalue' || resolved.kind === 'value')
    return resolved.node;
  if (resolved.kind === 'table' || resolved.kind === 'top-level')
    return resolved.node;
  return null;
}

/**
 * Synthesise an object covering all pending insertions whose paths
 * strictly extend `path`. Used when a caller queries an intermediate
 * level above a deep path-create.
 *
 * Returns `null` when no pending insertion contributes.
 */
function synthesiseSubtree(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath;
  },
): Record<string, unknown> | null {
  let acc: Record<string, unknown> | null = null;
  for (const ins of edit.insertions) {
    const insPath = ins.path;
    if (insPath === undefined) continue;
    if (insPath.length <= path.length) continue;
    const matches = path.every(function eq(seg, i,) {
      return seg === insPath[i];
    },);
    if (!matches) continue;
    const rest = insPath.slice(path.length,);
    const restStrings = asStringPath({ segs: rest, },);
    if (restStrings === null) continue;
    acc = mergeAt({
      base: acc ?? {},
      segments: restStrings,
      value: ins.jsValue,
    },);
  }
  return acc;
}

/**
 * Project `segs` to a `string[]` when every segment is a string; else
 * `null`. Used in sub-tree synthesis to skip insertions whose path
 * goes through an array (a sub-tree can't be reconstructed via key
 * navigation alone).
 */
function asStringPath(
  { segs, }: { segs: TomlPath; },
): readonly string[] | null {
  const result: string[] = [];
  for (const s of segs) {
    if (typeof s !== 'string') return null;
    result.push(s,);
  }
  return result;
}

/** Merge `value` into `base` at the chain of segments, returning a fresh object. */
function mergeAt(
  {
    base,
    segments,
    value,
  }: {
    base: Record<string, unknown>;
    segments: readonly string[];
    value: unknown;
  },
): Record<string, unknown> {
  if (segments.length === 0) return base;
  const head = segments[0];
  if (head === undefined) return base;
  if (segments.length === 1)
    return { ...base, [head]: value, };
  const existing = base[head];
  const child = isPlainObject(existing,) ? existing : {};
  return {
    ...base,
    [head]: mergeAt({
      base: child,
      segments: segments.slice(1,),
      value,
    },),
  };
}

/**
 * Navigate a JS value with the remaining path segments.
 *
 * Returns `pending-value` on success or `missing` when navigation hits
 * `undefined` / a non-traversable shape.
 */
function navigateJsValue(
  {
    edit,
    value,
    rest,
  }: {
    edit: TomlEditState;
    value: unknown;
    rest: TomlPath;
  },
): EffectiveResult {
  if (rest.length === 0) {
    if (value === undefined)
      return missingFor({ edit, },);
    return { kind: 'pending-value', value, };
  }
  const [head, ...remaining] = rest;
  if (head === undefined) return missingFor({ edit, },);
  if (typeof head === 'number') {
    if (!Array.isArray(value,)) return missingFor({ edit, },);
    return navigateJsValue({ edit, value: value[head], rest: remaining, },);
  }
  if (!isPlainObject(value,))
    return missingFor({ edit, },);
  return navigateJsValue({
    edit,
    value: value[head],
    rest: remaining,
  },);
}

/** AST-only resolution (no cross-path projection); used as fallback. */
function resolveAst(
  { edit, path, }: { edit: TomlEditState; path: TomlPath; },
): EffectiveResult {
  const base = resolveByPath({ edit, path, },);
  if (base.kind === 'keyvalue') {
    if (edit.deletions.has(base.node,))
      return { kind: 'deleted', };
    const pending = edit.edits.get(base.node,);
    if (pending !== undefined)
      return { kind: 'pending-value', value: pending.jsValue, };
  }
  if (base.kind === 'value') {
    const pending = edit.edits.get(base.node,);
    if (pending !== undefined)
      return { kind: 'pending-value', value: pending.jsValue, };
  }
  if (base.kind === 'table' && edit.deletions.has(base.node,))
    return { kind: 'deleted', };
  if (
    base.kind === 'array-of-tables'
    && base.nodes.every(function isDeleted(n,) {
      return edit.deletions.has(n,);
    },)
  )
    return { kind: 'deleted', };
  return base;
}

/** Strict equality on two TOML paths (segment-wise). */
function pathEquals(
  { a, b, }: { a: TomlPath; b: TomlPath; },
): boolean {
  if (a.length !== b.length) return false;
  return a.every(function eq(seg, i,) {
    return seg === b[i];
  },);
}

/**
 * Apply any pending `replace-value` edit to a `TOMLContentNode`, returning
 * the effective text representation. Currently a passthrough; populated by
 * the write API.
 */
export function effectiveValueText(
  { edit, node, }: { edit: TomlEditState; node: AST.TOMLContentNode; },
): { kind: 'edited'; text: string; } | { kind: 'parse-time'; node: AST.TOMLContentNode; } {
  const pending = edit.edits.get(node,);
  if (pending !== undefined && pending.kind === 'replace-value')
    return { kind: 'edited', text: pending.newText, };
  return { kind: 'parse-time', node, };
}
