/**
 * AST walker helpers for `resolveByPath`.
 *
 * Pure functions split out of `resolve.ts` to keep each file under the
 * 300-LOC cap. The walker descends array and table containers, dispatching
 * on `container.type`, and reports a `ResolveResult` back to the resolver.
 *
 * AST-mutation invariant: this module never modifies AST internals.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import type { AST, } from 'toml-eslint-parser';

import { TomlImmutableNodeError, } from './errors.ts';
import { keysOf, } from './path.ts';
import type { ResolveResult, } from './resolve.ts';
import type { TomlPath, } from './types.ts';

/**
 * Sentinel for "no key-value whose key list prefixes the query segments".
 *
 * A unique `Symbol` rather than `null`: `no-nullish-union` bans a nullish
 * "absent" arm, and the matched shape is always a plain object so the
 * symbol never collides with a real hit.
 */
const KEYVALUE_NOT_FOUND = Symbol('toml-edit/keyvalue-not-found',);

/**
 * Dispatch to the array or table walker based on `container.type`.
 *
 * @returns Computed result (`ResolveResult`).
 *
 * @example
 * ```ts
 * walk({ container: edit.program.body[0], segments: ['fruits', 0,], consumed: 0, },);
 * ```
 */
export function walk(
  {
    container,
    segments,
    consumed,
  }: {
    readonly container: AST.TOMLNode;
    readonly segments: TomlPath;
    readonly consumed: number;
  },
): ResolveResult {
  if (container.type
    === 'TOMLArray') {
    return walkArray({
      container,
      segments,
      consumed,
    },);
  }
  return walkTable({
    container,
    segments,
    consumed,
  },);
}

/**
 * Walk into a `TOMLArray`, indexing the first segment as a number.
 *
 * @returns Computed result (`ResolveResult`).
 */
function walkArray(
  {
    container,
    segments,
    consumed,
  }: {
    readonly container: AST.TOMLArray;
    readonly segments: TomlPath;
    readonly consumed: number;
  },
): ResolveResult {
  /** Current segment so the walker can branch on numeric vs string. */
  const segment = nonNullishOrThrow(segments[0],);
  if ((typeof segment) !== 'number') {
    return {
      kind: 'missing',
      deepest: container,
      consumed,
    };
  }
  /** Array element at the numeric index, or `undefined` for an out-of-bounds miss. */
  const element = container.elements[segment];
  if (element === undefined) {
    return {
      kind: 'missing',
      deepest: container,
      consumed,
    };
  }
  if (segments.length
    === 1) {
    return {
      kind: 'value',
      node: element,
    };
  }
  if ((element.type
    === 'TOMLArray') || (element.type
      === 'TOMLInlineTable')) {
    return walk({
      container: element,
      segments: segments.slice(1,),
      consumed: consumed + 1,
    },);
  }
  return {
    kind: 'missing',
    deepest: element,
    consumed: consumed + 1,
  };
}

/**
 * Walk a table container: first try key-values, then descend into matching child tables.
 *
 * @returns Computed result (`ResolveResult`).
 */
function walkTable(
  {
    container,
    segments,
    consumed,
  }: {
    readonly container: AST.TOMLNode;
    readonly segments: TomlPath;
    readonly consumed: number;
  },
): ResolveResult {
  if ((container.type
    !== 'TOMLTopLevelTable')
    && (container.type
      !== 'TOMLTable')
    && (container.type
      !== 'TOMLInlineTable')) {
    throw new TomlImmutableNodeError(
      `walkTable: expected table container, got ${container.type}`,
    );
  }
  /** First-pass key-value lookup so a direct hit short-circuits the table walk. */
  const directKeyValue = findKeyValueByPrefix({
    container,
    segments,
  },);
  if (directKeyValue !== KEYVALUE_NOT_FOUND) {
    /** Destructure so the matched key-value and its key-chain length read by name. */
    const {
      node,
      matchedLen,
    } = directKeyValue;
    if (segments.length
      === matchedLen) {
      return {
        kind: 'keyvalue',
        node,
      };
    }
    /** Remaining segments after the matched key chain; drives recursion into the value. */
    const rest = segments.slice(matchedLen,);
    if ((node.value
      .type
      === 'TOMLArray') || (node.value
        .type
        === 'TOMLInlineTable')) {
      return walk({
        container: node.value,
        segments: rest,
        consumed: consumed + matchedLen,
      },);
    }
    return {
      kind: 'missing',
      deepest: node,
      consumed: consumed + matchedLen,
    };
  }

  if (container.type
    !== 'TOMLTopLevelTable') {
    return {
      kind: 'missing',
      deepest: container,
      consumed,
    };
  }

  /** Tables whose header is a prefix of `segments`; candidates to descend into. */
  const descendable = container
    .body
    .filter(
    function isDescendable(child,): child is AST.TOMLTable {
      if (child.type
        !== 'TOMLTable')
        return false;
      /** Sibling's resolved key so prefix checks reuse one binding. */
      const rk = child.resolvedKey;
      if (rk.length
        > segments
        .length)
        return false;
      return rk.every(function eq(
        k,
        i,
      ) {
        return segments[i]
          === k;
      },);
    },
  );

  if (descendable.length
    > 0) {
    /** Longest-prefix candidate so the most specific table wins. */
    const best = nonNullishOrThrow(
      descendable
        .toSorted(function byPrefixLenDesc(
          a,
          b,
        ) {
          return b.resolvedKey
            .length
            - a
            .resolvedKey
            .length;
        },)[0],
    );
    /** Header length so the walker can skip already-matched segments. */
    const prefixLen = best.resolvedKey
      .length;
    if (segments.length
      === prefixLen) {
      return {
        kind: 'table',
        node: best,
      };
    }
    return walk({
      container: best,
      segments: segments.slice(prefixLen,),
      consumed: consumed + prefixLen,
    },);
  }

  /** Tables nested strictly under `segments`; populate the array-of-tables result. */
  const tablesUnder = container
    .body
    .filter(
    function isUnder(child,): child is AST.TOMLTable {
      if (child.type
        !== 'TOMLTable')
        return false;
      /** Sibling's resolved key so prefix checks reuse one binding. */
      const rk = child.resolvedKey;
      if (rk.length
        <= segments
        .length)
        return false;
      return segments.every(function eq(
        s,
        i,
      ) {
        return rk[i]
          === s;
      },);
    },
  );

  if (tablesUnder.length
    > 0) {
    return {
      kind: 'array-of-tables',
      nodes: tablesUnder,
    };
  }

  return {
    kind: 'missing',
    deepest: container,
    consumed,
  };
}

/**
 * Find a key-value whose full key list is a prefix of `segments`.
 *
 * @returns Matched node and key-chain length, or `KEYVALUE_NOT_FOUND`.
 */
function findKeyValueByPrefix(
  {
    container,
    segments,
  }: {
    readonly container: AST.TOMLNode;
    readonly segments: TomlPath;
  },
): {
  node: AST.TOMLKeyValue;
  matchedLen: number;
} | typeof KEYVALUE_NOT_FOUND {
  if ((container.type
    !== 'TOMLTopLevelTable')
    && (container.type
      !== 'TOMLTable')
    && (container.type
      !== 'TOMLInlineTable')) {
    throw new TomlImmutableNodeError(
      `findKeyValueByPrefix: expected table container, got ${container.type}`,
    );
  }
  for (const child of container.body) {
    if (child.type
      !== 'TOMLKeyValue')
      continue;
    /** All key segments of this entry so the prefix check can compare directly. */
    const keys = keysOf({ key: child.key, },);
    if (keys.length
      > segments
      .length)
      continue;
    /** True when every key segment matches the corresponding `segments` entry. */
    const allMatch = keys.every(function eq(
      k,
      i,
    ) {
      return segments[i]
        === k;
    },);
    if (allMatch) {
      return {
        node: child,
        matchedLen: keys.length,
      };
    }
  }
  return KEYVALUE_NOT_FOUND;
}
