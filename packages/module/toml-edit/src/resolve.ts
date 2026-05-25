/**
 * Resolve a `TomlPath` against the AST.
 *
 * Pure function: reads `edit.program` only; never inspects deltas. Higher
 * layers (`effective-value.ts`) apply pending edits on top of the result.
 *
 * Resolver policy when multiple standard `[a.b]` tables would match the same
 * logical path: pick the **last physical instance** in document order.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import type { AST, } from 'toml-eslint-parser';

import { keysOf, } from './path.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * The kind of node a path resolved to.
 */
/** Discriminated union of `resolveByPath` outcomes. */
export type ResolveResult =
  | {
    readonly kind: 'top-level';
    readonly node: AST.TOMLTopLevelTable;
  }
  | {
    readonly kind: 'keyvalue';
    readonly node: AST.TOMLKeyValue;
  }
  | {
    readonly kind: 'value';
    readonly node: AST.TOMLContentNode;
  }
  | {
    readonly kind: 'table';
    readonly node: AST.TOMLTable;
  }
  | {
    readonly kind: 'array-of-tables';
    readonly nodes: readonly AST.TOMLTable[];
  }
  | {
    readonly kind: 'missing';
    readonly deepest: AST.TOMLNode;
    readonly consumed: number;
  };

/** Any container the walker can descend into. */
type Container =
  | AST.TOMLTopLevelTable
  | AST.TOMLTable
  | AST.TOMLInlineTable
  | AST.TOMLArray;

/**
 * Find the node at `path` within `edit.program`.
 *
 * @param edit - The state to search.
 *
 * @param path - The TOML path to resolve.
 *
 * @returns A `ResolveResult` describing what was found, or `missing` with
 *          the deepest existing ancestor and how many path segments were
 *          consumed before the miss.
 *
 * @example
 * ```ts
 * resolveByPath({ edit, path: ['fruits', 0, 'name'] },);
 * // -> { kind: 'keyvalue', node: TOMLKeyValue }
 * ```
 */
export function resolveByPath(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath;
  },
): ResolveResult {
  /** Root container so the walker can descend without re-indexing every call. */
  const [root,] = edit.program
    .body;
  if (path.length
    === 0) {
    return {
      kind: 'top-level',
      node: root,
    };
  }
  return walk({
    container: root,
    segments: path,
    consumed: 0,
  },);
}

/**
 * Dispatch to the array or table walker based on `container.type`.
 *
 * @returns Computed result (`ResolveResult`).
 */
function walk(
  {
    container,
    segments,
    consumed,
  }: {
    container: Container;
    segments: TomlPath;
    consumed: number;
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
    container: AST.TOMLArray;
    segments: TomlPath;
    consumed: number;
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
    container: AST.TOMLTopLevelTable | AST.TOMLTable | AST.TOMLInlineTable;
    segments: TomlPath;
    consumed: number;
  },
): ResolveResult {
  /** First-pass key-value lookup so a direct hit short-circuits the table walk. */
  const directKeyValue = findKeyValueByPrefix({
    container,
    segments,
  },);
  if (directKeyValue !== null) {
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
  const descendable = container.body.filter(
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
  const tablesUnder = container.body.filter(
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
 * @returns Computed result.
 */
function findKeyValueByPrefix(
  {
    container,
    segments,
  }: {
    container: AST.TOMLTopLevelTable | AST.TOMLTable | AST.TOMLInlineTable;
    segments: TomlPath;
  },
): {
  node: AST.TOMLKeyValue;
  matchedLen: number;
} | null {
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
  return null;
}
