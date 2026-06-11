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

import {
  asStringPath,
  mergeAt,
  PATH_HAS_NUMERIC,
  pathEquals,
} from './effective-helpers.ts';
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
  | {
    readonly kind: 'pending-value';
    readonly value: unknown;
  }
  | ResolveResult;

/**
 * Sentinel for "no covering pending state at any prefix".
 *
 * A unique `Symbol` rather than `null`: `no-nullish-union` bans a nullish
 * "absent" arm, and an `EffectiveResult` is always a tagged object so the
 * symbol never collides with a real result.
 */
const NO_PROJECTION = Symbol('toml-edit/no-covering-pending-state',);

/**
 * Sentinel for "no pending insertion contributes to the synthesised subtree".
 *
 * A unique `Symbol` rather than `null`: `no-nullish-union` bans a nullish
 * arm, and an empty object would be ambiguous with a real empty subtree.
 */
const SUBTREE_ABSENT = Symbol('toml-edit/no-pending-insertion-subtree',);

/**
 * Resolve a path against the AST plus pending deltas.
 *
 * @returns Computed result (`EffectiveResult`).
 *
 * @example
 * ```ts
 * effectiveAt({ edit, path: ['arr', 1,] },);  // returns 30 after tomlDelete(['arr', 1])
 * ```
 */
export function effectiveAt(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): EffectiveResult {
  /**
   * Exact-path pending insertion wins before any walk, per the resolution policy.
   */
  const exactInsertion = edit.insertions
    .find(function matchesPath(ins,) {
    return (ins.path
      !== undefined) && pathEquals({
      a: ins.path,
      b: path,
    },);
  },);
  if (exactInsertion !== undefined) {
    return {
      kind: 'pending-value',
      value: exactInsertion.jsValue,
    };
  }

  /**
   * Longest-prefix walk so a covering ancestor edit shows through.
   */
  const prefixProjection = projectPendingAtPrefix({
    edit,
    path,
  },);
  if (prefixProjection !== NO_PROJECTION)
    return prefixProjection;

  /**
   * Sub-tree synthesis merges pending descendants for intermediate-level reads.
   */
  const subtree = synthesiseSubtree({
    edit,
    path,
  },);
  if (subtree !== SUBTREE_ABSENT) {
    return {
      kind: 'pending-value',
      value: subtree,
    };
  }

  return resolveAst({
    edit,
    path,
  },);
}

/**
 * Synthetic `missing` placeholder for JS-space dead-ends. Uses the
 * program's top-level table as a non-null `deepest` sentinel; consumers
 * only read `kind` from the missing arm.
 *
 * @returns Computed result (`ResolveResult`).
 */
function missingFor(
  { edit, }: { readonly edit: TomlEditState; },
): ResolveResult {
  return {
    kind: 'missing',
    deepest: edit.program
      .body[0],
    consumed: 0,
  };
}

/**
 * Walk `path` longest-prefix-first looking for any pending state that
 * covers the prefix; navigate the JS value space for the remaining
 * segments.
 *
 * Returns `NO_PROJECTION` when no covering pending state exists.
 *
 * @returns Result, or `NO_PROJECTION` when no match.
 */
function projectPendingAtPrefix(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): EffectiveResult | typeof NO_PROJECTION {
  for (let prefixLen = path.length; prefixLen >= 1; prefixLen--) {
    /**
     * Candidate ancestor path being probed at this iteration.
     */
    const prefix = path.slice(
      0,
      prefixLen,
    );
    /**
     * Remaining segments to navigate inside the matched JS value.
     */
    const rest = path.slice(prefixLen,);

    /**
     * Pending insertion that covers this prefix exactly, if any.
     */
    const matchingIns = edit.insertions
      .find(function matches(ins,) {
      return (ins.path
        !== undefined) && pathEquals({
        a: ins.path,
        b: prefix,
      },);
    },);
    if (matchingIns !== undefined) {
      return navigateJsValue({
        edit,
        value: matchingIns.jsValue,
        rest,
      },);
    }

    /**
     * AST resolution at the prefix so a pending edit can be looked up.
     */
    const baseAtPrefix = resolveByPath({
      edit,
      path: prefix,
    },);
    /**
     * AST node a pending edit could be keyed on. For `keyvalue` the splice
     * engine uses `value.range`; for `value` the content node is used
     * directly; `table`/`top-level` carry their own node. Other kinds have
     * no single editable node.
     */
    const pendingNode = ((baseAtPrefix.kind
      === 'keyvalue')
      || (baseAtPrefix.kind
        === 'value')
      || (baseAtPrefix.kind
        === 'table')
      || (baseAtPrefix.kind
        === 'top-level'))
      ? baseAtPrefix.node
      : null;
    if (pendingNode !== null) {
      if (edit.deletions
        .has(pendingNode,))
        return { kind: 'deleted', };
      /**
       * Pending edit's jsValue is the surface to navigate.
       */
      const pendingEdit = edit.edits
        .get(pendingNode,);
      if ((pendingEdit !== undefined) && (pendingEdit.jsValue
        !== undefined)) {
        return navigateJsValue({
          edit,
          value: pendingEdit.jsValue,
          rest,
        },);
      }
    }
  }
  return NO_PROJECTION;
}

/**
 * Synthesise an object covering all pending insertions whose paths
 * strictly extend `path`. Used when a caller queries an intermediate
 * level above a deep path-create.
 *
 * Returns `SUBTREE_ABSENT` when no pending insertion contributes.
 *
 * @returns Result, or `SUBTREE_ABSENT` when no match.
 */
function synthesiseSubtree(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): Record<string, unknown> | typeof SUBTREE_ABSENT {
  /**
   * Lazy accumulator so an empty pending set returns `SUBTREE_ABSENT` instead of `{}`.
   */
  let acc: Record<string, unknown> | typeof SUBTREE_ABSENT = SUBTREE_ABSENT;
  for (const ins of edit.insertions) {
    /**
     * Path field is optional; skip insertions without a path.
     */
    const insPath = ins.path;
    if (insPath === undefined)
      continue;
    if (insPath.length
      <= path
      .length)
      continue;
    /**
     * True when `path` is a strict prefix of `insPath`.
     */
    const matches = path.every(function eq(
      seg,
      i,
    ) {
      return seg === insPath[i];
    },);
    if (!matches)
      continue;
    /**
     * Segments after the prefix; describes where to merge `jsValue`.
     */
    const rest = insPath.slice(path.length,);
    /**
     * Numeric segments rule out merging into a plain object.
     */
    const restStrings = asStringPath({ segs: rest, },);
    if (restStrings === PATH_HAS_NUMERIC)
      continue;
    acc = mergeAt({
      base: acc === SUBTREE_ABSENT ? {} : acc,
      segments: restStrings,
      value: ins.jsValue,
    },);
  }
  return acc;
}

/**
 * Navigate a JS value with the remaining path segments.
 *
 * Returns `pending-value` on success or `missing` when navigation hits
 * `undefined` / a non-traversable shape.
 *
 * @returns Computed result (`EffectiveResult`).
 */
function navigateJsValue(
  {
    edit,
    value,
    rest,
  }: {
    readonly edit: TomlEditState;
    readonly value: unknown;
    readonly rest: TomlPath;
  },
): EffectiveResult {
  if (rest.length
    === 0) {
    if (value === undefined)
      return missingFor({ edit, },);
    return {
      kind: 'pending-value',
      value,
    };
  }
  /**
   * Current segment so each recursion step navigates one level deeper.
   */
  const [head, ...remaining] = rest;
  if (head === undefined)
    return missingFor({ edit, },);
  if ((typeof head) === 'number') {
    if (!Array.isArray(value,))
      return missingFor({ edit, },);
    return navigateJsValue({
      edit,
      value: value[head],
      rest: remaining,
    },);
  }
  if (!isPlainObject(value,))
    return missingFor({ edit, },);
  return navigateJsValue({
    edit,
    value: value[head],
    rest: remaining,
  },);
}

/**
 * AST-only resolution (no cross-path projection); used as fallback.
 *
 * @returns Computed result (`EffectiveResult`).
 */
function resolveAst(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): EffectiveResult {
  /**
   * AST-only resolution so deletion and edit lookups can be keyed by node identity.
   */
  const base = resolveByPath({
    edit,
    path,
  },);
  if (base.kind
    === 'keyvalue') {
    if (edit.deletions
      .has(base.node,))
      return { kind: 'deleted', };
    /**
     * Pending replace-value edit on this keyvalue, if any.
     */
    const pending = edit.edits
      .get(base.node,);
    if (pending !== undefined) {
      return {
        kind: 'pending-value',
        value: pending.jsValue,
      };
    }
  }
  if (base.kind
    === 'value') {
    /**
     * Pending element edit on this content node, if any.
     */
    const pending = edit.edits
      .get(base.node,);
    if (pending !== undefined) {
      return {
        kind: 'pending-value',
        value: pending.jsValue,
      };
    }
  }
  if ((base.kind
    === 'table')
    && edit
    .deletions
    .has(base.node,))
    return { kind: 'deleted', };
  if (
    (base.kind
      === 'array-of-tables')
      && base
      .nodes
      .every(function isDeleted(n,) {
      return edit.deletions
        .has(n,);
    },)
  ) {
    return { kind: 'deleted', };
  }
  return base;
}
