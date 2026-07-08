/**
 * Replace (or extend into) an existing value in the block tree for {@link tomlSet}.
 *
 * Descends through standard-table bodies, array-of-tables instances, and
 * key-value values (arrays, inline tables) to the addressed node, returning a
 * fresh block list with that value replaced. An edited array/inline table is
 * marked synthetic so it re-renders canonically; the enclosing key-value's key
 * line stays clean. Returns {@link NOT_SET} when the path is not an existing
 * value (the caller then creates or table-replaces).
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { buildValueFromInput, } from './build-input.ts';
import type {
  Block,
  KeyValueNode,
  ValueNode,
} from './document.ts';
import { TomlImmutableNodeError, } from './errors.ts';
import { formatPath, } from './path.ts';
import type {
  CanonicalOptions,
  TomlPath,
} from './types.ts';

/**
 * Sentinel for "no existing value at this path".
 */
export const NOT_SET: unique symbol = Symbol('toml-edit/not-set',);

/**
 * True when `a` equals `b` segment-wise up to `a.length`, and `a` is no longer
 * than `b` (i.e. `a` is a prefix of `b`, equality allowed).
 *
 * @returns Resulting boolean.
 */
function isPrefix(
  a: readonly (string | number)[],
  b: TomlPath,
): boolean {
  return (a.length
    <= b.length)
    && a.every(function eq(
      seg,
      i,
    ) {
      return seg === b[i];
    },);
}

/**
 * Existing-node argument for {@link buildValueFromInput}: present only when the
 * current value is clean, so an equal re-set preserves its raw spelling.
 *
 * @returns An object with `existing` set, or empty.
 */
function existingArg(value: ValueNode,): { readonly existing?: AST.TOMLNode; } {
  /**
   * Retained parse-time node when clean; narrowed to a const so the spread type is exact.
   */
  const node = value.origin
    .kind
    === 'clean' ? value.origin
    .astNode : undefined;
  return node === undefined ? {} : { existing: node, };
}

/**
 * Replace the existing value at `path` within `blocks`.
 *
 * @returns Fresh blocks, or {@link NOT_SET} when the path has no existing value.
 *
 * @example
 * ```ts
 * replaceExistingValue({ blocks, path: ['a','x'], value: 2, options, },);
 * ```
 */
export function replaceExistingValue(
  {
    blocks,
    path,
    value,
    options,
  }: {
    readonly blocks: readonly Block[];
    readonly path: TomlPath;
    readonly value: unknown;
    readonly options: CanonicalOptions;
  },
): readonly Block[] | typeof NOT_SET {
  for (const [index, block,] of blocks.entries()) {
    /**
     * Replacement block if this one owns the path, else the not-set sentinel.
     */
    const replaced = replaceInBlock({
      block,
      path,
      value,
      options,
    },);
    if (replaced !== NOT_SET)
      return blocks.with(
        index,
        replaced,
      );
  }
  return NOT_SET;
}

/**
 * Attempt to replace the value at `path` within a single block.
 *
 * @returns Replacement block, or {@link NOT_SET}.
 */
function replaceInBlock(
  {
    block,
    path,
    value,
    options,
  }: {
    readonly block: Block;
    readonly path: TomlPath;
    readonly value: unknown;
    readonly options: CanonicalOptions;
  },
): Block | typeof NOT_SET {
  if (block.kind
    === 'keyvalue')
    return replaceInKeyValue({
      kv: block,
      path,
      value,
      options,
    },);
  if (block.kind
    !== 'table')
    return NOT_SET;
  /**
   * Header path length; a strict prefix means the target lives in the body.
   */
  const headerLen = block.headerSegments
    .length;
  /**
   * For array instances the next segment must select this instance's index.
   */
  const bodyPathStart = block.tableKind
    === 'array' ? headerLen + 1 : headerLen;
  if (block.tableKind
    === 'array' && (path[headerLen] !== block.aotIndex))
    return NOT_SET;
  if (!isPrefix(
    block.headerSegments,
    path,
  ) || (path.length
    < bodyPathStart + 1))
    return NOT_SET;
  /**
   * Body result after descending with the remaining path segments.
   */
  const newBody = replaceExistingValue({
    blocks: block.body,
    path: path.slice(bodyPathStart,),
    value,
    options,
  },);
  if (newBody === NOT_SET)
    return NOT_SET;
  return {
    ...block,
    body: newBody,
  };
}

/**
 * Attempt to replace the value at `path` within a key-value.
 *
 * @returns Replacement key-value, or {@link NOT_SET}.
 */
function replaceInKeyValue(
  {
    kv,
    path,
    value,
    options,
  }: {
    readonly kv: KeyValueNode;
    readonly path: TomlPath;
    readonly value: unknown;
    readonly options: CanonicalOptions;
  },
): KeyValueNode | typeof NOT_SET {
  if (!isPrefix(
    kv.keySegments,
    path,
  ))
    return NOT_SET;
  if (kv.keySegments
    .length
    === path.length) {
    return {
      ...kv,
      value: buildValueFromInput({
        input: value,
        options,
        ...existingArg(kv.value,),
      },),
    };
  }
  /**
   * Value after descending the remaining segments into the current value.
   */
  const newValue = replaceInValue({
    value: kv.value,
    rest: path.slice(kv.keySegments
      .length,),
    input: value,
    options,
    path,
  },);
  if (newValue === NOT_SET)
    return NOT_SET;
  return {
    ...kv,
    value: newValue,
  };
}

/**
 * Descend `rest` into an array or inline-table value and replace (or, for a
 * missing inline key, append) the leaf.
 *
 * @returns Replacement value node, or {@link NOT_SET}.
 *
 * @throws {@link TomlImmutableNodeError} when an inline extension collides with an
 *         existing key chain.
 */
function replaceInValue(
  {
    value,
    rest,
    input,
    options,
    path,
  }: {
    readonly value: ValueNode;
    readonly rest: TomlPath;
    readonly input: unknown;
    readonly options: CanonicalOptions;
    readonly path: TomlPath;
  },
): ValueNode | typeof NOT_SET {
  /**
   * Leading segment selecting the child to descend into or replace.
   */
  const [head, ...tail] = rest;
  if ((value.kind
    === 'array') && ((typeof head) === 'number')) {
    /**
     * Targeted element, or `undefined` when the index is out of range.
     */
    const element = value.elements[head];
    if (element === undefined)
      return NOT_SET;
    /**
     * New element: a direct replace at the tail, or a deeper descent.
     */
    const newEl = tail.length
      === 0
      ? buildValueFromInput({
        input,
        options,
        ...existingArg(element,),
      },)
      : replaceInValue({
        value: element,
        rest: tail,
        input,
        options,
        path,
      },);
    if (newEl === NOT_SET)
      return NOT_SET;
    return {
      kind: 'array',
      elements: value.elements
        .with(
        head,
        newEl,
      ),
      origin: { kind: 'synthetic', },
    };
  }
  if (value.kind
    === 'inline-table')
    return replaceInInlineTable({
      value,
      rest,
      input,
      options,
      path,
    },);
  return NOT_SET;
}

/**
 * Replace a matching entry in an inline table, or append a new dotted entry.
 *
 * @returns Replacement inline-table node.
 *
 * @throws {@link TomlImmutableNodeError} when the new key chain overlaps an existing one.
 */
function replaceInInlineTable(
  {
    value,
    rest,
    input,
    options,
    path,
  }: {
    readonly value: Extract<ValueNode, { kind: 'inline-table'; }>;
    readonly rest: TomlPath;
    readonly input: unknown;
    readonly options: CanonicalOptions;
    readonly path: TomlPath;
  },
): ValueNode {
  for (const [j, entry,] of value.entries
    .entries()) {
    if (!isPrefix(
      entry.keySegments,
      rest,
    ))
      continue;
    /**
     * New entry: replace whole value at an exact key hit, else descend deeper.
     */
    const newEntry = entry.keySegments
      .length
      === rest.length
      ? {
        ...entry,
        value: buildValueFromInput({
          input,
          options,
          ...existingArg(entry.value,),
        },),
      }
      : descendInlineEntry({
        entry,
        rest,
        input,
        options,
        path,
      },);
    if (newEntry === NOT_SET)
      continue;
    return {
      kind: 'inline-table',
      entries: value.entries
        .with(
        j,
        newEntry,
      ),
      origin: { kind: 'synthetic', },
    };
  }
  return appendInlineEntry({
    value,
    rest,
    input,
    options,
    path,
  },);
}

/**
 * Descend into an inline entry's value for a deeper replace.
 *
 * @returns Replacement key-value, or {@link NOT_SET}.
 */
function descendInlineEntry(
  {
    entry,
    rest,
    input,
    options,
    path,
  }: {
    readonly entry: KeyValueNode;
    readonly rest: TomlPath;
    readonly input: unknown;
    readonly options: CanonicalOptions;
    readonly path: TomlPath;
  },
): KeyValueNode | typeof NOT_SET {
  /**
   * Value after descending past this entry's matched key segments.
   */
  const nested = replaceInValue({
    value: entry.value,
    rest: rest.slice(entry.keySegments
      .length,),
    input,
    options,
    path,
  },);
  if (nested === NOT_SET)
    return NOT_SET;
  return {
    ...entry,
    value: nested,
  };
}

/**
 * Append a new dotted entry to an inline table (extension), after a collision
 * check against existing entries.
 *
 * @returns Extended inline-table node.
 *
 * @throws {@link TomlImmutableNodeError} on an overlapping key chain, or when a
 *         segment of `rest` is numeric.
 */
function appendInlineEntry(
  {
    value,
    rest,
    input,
    options,
    path,
  }: {
    readonly value: Extract<ValueNode, { kind: 'inline-table'; }>;
    readonly rest: TomlPath;
    readonly input: unknown;
    readonly options: CanonicalOptions;
    readonly path: TomlPath;
  },
): ValueNode {
  /**
   * String-only new key chain; a numeric segment cannot address an inline key.
   */
  const segs = rest.map(function asString(seg,) {
    if ((typeof seg) !== 'string') {
      throw new TomlImmutableNodeError(
        `Cannot set numeric segment ${String(seg,)} in ${formatPath({ path, },)}`,
      );
    }
    return seg;
  },);
  for (const entry of value.entries) {
    if (isPrefix(
      entry.keySegments,
      rest,
    ) || isPrefix(
      segs,
      entry.keySegments,
    )) {
      throw new TomlImmutableNodeError(
        `tomlSet at ${
          formatPath({ path, },)
        } would create invalid TOML: inline-table key ${
          entry.keySegments
            .join('.',)
        } overlaps ${segs.join('.',)}`,
      );
    }
  }
  return {
    kind: 'inline-table',
    entries: [
      ...value.entries,
      {
        kind: 'keyvalue',
        keySegments: segs,
        value: buildValueFromInput({
          input,
          options,
        },),
        origin: { kind: 'synthetic', },
        commentsBefore: [],
      },
    ],
    origin: { kind: 'synthetic', },
  };
}
