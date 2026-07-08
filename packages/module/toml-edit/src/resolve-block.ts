/**
 * Locate the entry block (key-value or table) a path names, for comment ops.
 *
 * Unlike {@link locateValueNode}, this returns the enclosing block so callers
 * can read its line span and attached comments.
 *
 * @module
 */

import type {
  Block,
  KeyValueNode,
  TableNode,
} from './document.ts';
import { NOT_LOCATED, } from './resolve-document.ts';
import type { TomlPath, } from './types.ts';

/**
 * A located entry block.
 */
export type LocatedBlock =
  | { readonly kind: 'kv'; readonly kv: KeyValueNode; }
  | { readonly kind: 'table'; readonly table: TableNode; }
  | { readonly kind: 'aot'; readonly tables: readonly TableNode[]; };

/**
 * True when `a` equals `b` segment-wise (same length).
 *
 * @returns Resulting boolean.
 */
function segmentsEqual(
  a: readonly (string | number)[],
  b: TomlPath,
): boolean {
  return (a.length
    === b.length)
    && a.every(function eq(
      seg,
      i,
    ) {
      return seg === b[i];
    },);
}

/**
 * True when `a` is a strict prefix of `b`.
 *
 * @returns Resulting boolean.
 */
function isStrictPrefix(
  a: readonly (string | number)[],
  b: TomlPath,
): boolean {
  return (a.length
    < b.length)
    && a.every(function eq(
      seg,
      i,
    ) {
      return seg === b[i];
    },);
}

/**
 * Locate the entry block named by `path`.
 *
 * @returns A {@link LocatedBlock}, or {@link NOT_LOCATED}.
 *
 * @example
 * ```ts
 * locateBlock({ blocks: edit.blocks, path: ['tools'], },);
 * ```
 */
export function locateBlock(
  {
    blocks,
    path,
  }: {
    readonly blocks: readonly Block[];
    readonly path: TomlPath;
  },
): LocatedBlock | typeof NOT_LOCATED {
  /**
   * Exact key-value hit takes priority over any table scan.
   */
  const kv = blocks.find(function isKv(b,): b is KeyValueNode {
    return (b.kind
      === 'keyvalue')
      && segmentsEqual(
        b.keySegments,
        path,
      );
  },);
  if (kv !== undefined)
    return {
      kind: 'kv',
      kv,
    };
  /**
   * Table sections whose header exactly names the path.
   */
  const exact = blocks.filter(function isExact(b,): b is TableNode {
    return (b.kind
      === 'table')
      && segmentsEqual(
        b.headerSegments,
        path,
      );
  },);
  if (exact.length
    > 0) {
    /**
     * First exact section so a standard header resolves to it.
     */
    const [first,] = exact;
    if ((first !== undefined) && (first.tableKind
      === 'standard'))
      return {
        kind: 'table',
        table: first,
      };
    return {
      kind: 'aot',
      tables: exact,
    };
  }
  /**
   * Standard table whose header strictly prefixes the path; descend its body.
   */
  const parent = blocks.find(function isParent(b,): b is TableNode {
    return (b.kind
      === 'table')
      && (b.tableKind
        === 'standard')
      && isStrictPrefix(
        b.headerSegments,
        path,
      );
  },);
  if (parent !== undefined)
    return locateBlock({
      blocks: parent.body,
      path: path.slice(parent.headerSegments
        .length,),
    },);
  return NOT_LOCATED;
}
