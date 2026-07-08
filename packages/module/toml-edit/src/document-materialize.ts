/**
 * Materialize a whole {@link TomlEditState} into a nested JS value, and
 * navigate it by {@link TomlPath}.
 *
 * Folds top-level key-values and table sections into one object the same way
 * `getStaticTOMLValue` folds an AST: dotted keys and `[a.b]` headers nest into
 * objects, `[[foo]]` headers append objects to an array. Because it walks the
 * current tree, reads reflect every prior mutation.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type {
  Block,
  TableNode,
} from './document.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';
import {
  containerAt,
  materializeValue,
  setNested,
} from './value-materialize.ts';

/**
 * Sentinel for "no value at this path". A unique symbol so it never collides
 * with a real materialized value (which may legitimately be `undefined`-free
 * but never this symbol).
 */
export const MISSING: unique symbol = Symbol('toml-edit/missing',);

/**
 * Materialize the whole document into a nested JS object.
 *
 * @returns Root object.
 *
 * @example
 * ```ts
 * materializeDocument({ edit, },); // { title: 'x', tools: { bun: 'latest' } }
 * ```
 */
export function materializeDocument(
  { edit, }: { readonly edit: TomlEditState; },
): Record<string, unknown> {
  return edit.blocks
    .reduce(
    function step(
      root: Record<string, unknown>,
      block,
    ) {
      if (block.kind
        === 'filler')
        return root;
      if (block.kind
        === 'keyvalue') {
        return setNested({
          target: root,
          segments: block.keySegments,
          value: materializeValue({ value: block.value, },),
        },);
      }
      return foldTable({
        root,
        table: block,
      },);
    },
    {},
  );
}

/**
 * Fold one table section (standard or array-of-tables) into `root`.
 *
 * @returns The same `root`.
 */
function foldTable(
  {
    root,
    table,
  }: {
    readonly root: Record<string, unknown>;
    readonly table: TableNode;
  },
): Record<string, unknown> {
  /**
   * Body key-values so both table kinds share the fold into a target object.
   */
  const bodyKvs = table.body
    .filter(function isKv(b,): b is Extract<Block, { kind: 'keyvalue'; }> {
    return b.kind
      === 'keyvalue';
  },);
  /**
   * Object the body entries fold into: the table itself, or a fresh AOT instance.
   */
  const target = table.tableKind
    === 'array'
    ? pushAotInstance({
      root,
      table,
    },)
    : containerAt({
      target: root,
      segments: table.headerSegments,
    },);
  for (const kv of bodyKvs) {
    setNested({
      target,
      segments: kv.keySegments,
      value: materializeValue({ value: kv.value, },),
    },);
  }
  return root;
}

/**
 * Append a fresh instance object to the array-of-tables at the header path.
 *
 * @returns The fresh instance object.
 */
function pushAotInstance(
  {
    root,
    table,
  }: {
    readonly root: Record<string, unknown>;
    readonly table: TableNode;
  },
): Record<string, unknown> {
  /**
   * Parent container holding the array; header path minus its final segment.
   */
  const parent = containerAt({
    target: root,
    segments: table.headerSegments
      .slice(
      0,
      -1,
    ),
  },);
  /**
   * Final header segment naming the array slot.
   */
  const key = String(nonNullishOrThrow(table.headerSegments
    .at(-1,),),);
  /**
   * Existing array at the slot, or a fresh one created now.
   */
  const existing = parent[key];
  /**
   * Array the new instance is appended to.
   */
  const arr = Array.isArray(existing,) ? existing : [];
  if (!Array.isArray(existing,))
    parent[key] = arr;
  /**
   * Fresh instance so this `[[foo]]` block's body has its own object.
   */
  const instance: Record<string, unknown> = {};
  arr.push(instance,);
  return instance;
}

/**
 * Navigate `path` through a materialized root, returning {@link MISSING} when a
 * segment does not resolve.
 *
 * @returns Value at the path, or {@link MISSING}.
 *
 * @example
 * ```ts
 * navigate({ root, path: ['tools', 'bun'], },);
 * ```
 */
export function navigate(
  {
    root,
    path,
  }: {
    readonly root: Record<string, unknown>;
    readonly path: TomlPath;
  },
): unknown {
  /**
   * Cursor descending one segment per step; short-circuits to MISSING on a miss.
   */
  let cursor: unknown = root;
  for (const seg of path) {
    if (Array.isArray(cursor,)) {
      if ((typeof seg) !== 'number')
        return MISSING;
      if ((seg < 0) || (seg >= cursor.length))
        return MISSING;
      cursor = cursor[seg];
      continue;
    }
    if ((cursor === null) || ((typeof cursor) !== 'object'))
      return MISSING;
    /**
     * Object property key for this segment.
     */
    const key = String(seg,);
    if (!Object.hasOwn(cursor, key,))
      return MISSING;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}
