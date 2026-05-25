/**
 * `tomlSet` path-create branches: when `resolveByPath` returns
 * `kind: 'missing'`, dispatch to the appropriate insertion strategy.
 *
 * Cases keyed on `resolved.deepest.type`:
 *
 * - `TOMLTopLevelTable` (Case A): emit `K1.K2...Kn = V` at top-level,
 *   anchored before any sibling table header (or eof if there are none).
 * - `TOMLTable` (Case B): emit `K1.K2...Kn = V` inside the table.
 * - `TOMLInlineTable` (Case C): re-emit the inline table with the new
 *   `K1.K2...Kn = V` entry appended via a `replace-value` Edit on the
 *   containing key-value (so cross-path effective-value resolution
 *   surfaces it). Nested inline tables inside an array are rejected.
 * - `TOMLArray` or scalar leaf (Case D): rejected.
 *
 * AST-mutation invariant: this module never modifies AST internals.
 *
 * @module
 */

import {
  type AST,
  getStaticTOMLValue,
} from 'toml-eslint-parser';

import {
  assertNoInlineTableCollision,
  assertNoSiblingTableCollision,
} from './collision.ts';
import { emitInlineTableWithExtra, } from './emit-value.ts';
import { TomlImmutableNodeError, } from './errors.ts';
import { formatPath, } from './path.ts';
import {
  withEditOn,
  withInsertion,
} from './state.ts';
import type {
  AnchorKind,
  TomlEditState,
  TomlPath,
} from './types.ts';
import {
  encodeKey,
  isPlainObject,
  jsValueToTomlText,
} from './values.ts';

/**
 * Dispatch the path-create branches.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 *
 * @example
 * ```ts
 * doPathCreate({ edit, path: ['a','b','c',], value: 42, resolved, },);
 * ```
 */
export function doPathCreate(
  {
    edit,
    path,
    value,
    resolved,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
    resolved: {
      kind: 'missing';
      deepest: AST.TOMLNode;
      consumed: number;
    };
  },
): TomlEditState {
  /** Segments not yet matched by the AST walk; describe the path to create. */
  const remaining = path.slice(resolved.consumed,);
  /** Deepest ancestor node so the dispatch can pick a strategy. */
  const { deepest, } = resolved;

  /** All-string remaining segments; numeric segments are rejected for path-create. */
  const dottedSegments: readonly string[] = remaining.map(function asString(seg,) {
    if ((typeof seg) !== 'string') {
      throw new TomlImmutableNodeError(
        `Cannot path-create at numeric segment ${String(seg,)} in path ${
          formatPath({ path, },)
        }`,
      );
    }
    return seg;
  },);

  if (deepest.type
    === 'TOMLTopLevelTable') {
    return doTopLevelDottedKeyInsert({
      edit,
      path,
      value,
      container: deepest,
      dottedSegments,
    },);
  }

  if (deepest.type
    === 'TOMLTable') {
    return doTableDottedKeyInsert({
      edit,
      path,
      value,
      container: deepest,
      dottedSegments,
    },);
  }

  if (deepest.type
    === 'TOMLInlineTable') {
    return doInlineTableExtend({
      edit,
      path,
      value,
      inlineTable: deepest,
      dottedSegments,
    },);
  }

  throw new TomlImmutableNodeError(
    `Cannot path-create through ${deepest.type} at path ${formatPath({ path, },)}`,
  );
}

/**
 * Case A: emit `dotted = value` at top-level.
 *
 * Anchor at `before-node` of the first sibling `TOMLTable` if any exists
 * in the top-level body; else `eof`. This avoids the TOML grammar trap
 * where a key-value after a `[section]` header is parsed as belonging
 * to that section.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 */
function doTopLevelDottedKeyInsert(
  {
    edit,
    path,
    value,
    container,
    dottedSegments,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
    container: AST.TOMLTopLevelTable;
    dottedSegments: readonly string[];
  },
): TomlEditState {
  assertNoSiblingTableCollision({
    programBody: container.body,
    basePath: [],
    dottedSegments,
    path,
  },);

  /** Encoded value text so the insertion is `dottedKey = valueText`. */
  const valueText = jsValueToTomlText({
    input: value,
    options: edit.canonical,
    existing: undefined,
  },);
  /** Dotted key spelling so each segment is encoded once. */
  const dottedKey = dottedSegments
    .map(function each(s,) {
      return encodeKey({ key: s, },);
    },)
    .join('.',);

  /** First `[foo]` header so the insertion can anchor before it. */
  const firstTable = container.body
    .find(
    function isTable(child,): child is AST.TOMLTable {
      return child.type
        === 'TOMLTable';
    },
  );

  /** Anchor: before the first table header, or EOF when there are no headers. */
  const anchor: AnchorKind = firstTable !== undefined
    ? {
      position: 'before-node',
      node: firstTable,
    }
    : 'eof';

  // For 'before-node', the byte at firstTable.range[0] is preceded by an
  // existing newline (the table header is on its own line), so no leading
  // prefix is needed. For 'eof', prepend a newline only when the source
  // ends mid-line.
  /** Leading newline only when the EOF insertion would land mid-line. */
  const prefix = firstTable !== undefined
    ? ''
    : ((edit.source
      === '') || edit
      .source
      .endsWith('\n',)
      ? ''
      : '\n');

  return withInsertion({
    edit,
    insertion: {
      anchor,
      text: `${prefix}${dottedKey} = ${valueText}\n`,
      path,
      jsValue: value,
    },
  },);
}

/**
 * Case B: emit `dotted = value` inside an existing `TOMLTable`.
 *
 * Uses the `inside-table` anchor and runs collision detection against
 * the program's top-level body so a sibling `[foo.sub]` that overlaps
 * the new dotted-key implicit-table path is caught before we record
 * the insertion.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 */
function doTableDottedKeyInsert(
  {
    edit,
    path,
    value,
    container,
    dottedSegments,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
    container: AST.TOMLTable;
    dottedSegments: readonly string[];
  },
): TomlEditState {
  assertNoSiblingTableCollision({
    programBody: edit.program
      .body[0]
      .body,
    basePath: container.resolvedKey,
    dottedSegments,
    path,
  },);

  /** Encoded value text so the insertion is `dottedKey = valueText`. */
  const valueText = jsValueToTomlText({
    input: value,
    options: edit.canonical,
    existing: undefined,
  },);
  /** Dotted key spelling so each segment is encoded once. */
  const dottedKey = dottedSegments
    .map(function each(s,) {
      return encodeKey({ key: s, },);
    },)
    .join('.',);

  /** Leading newline only when the source ends mid-line. */
  const prefix = edit.source
    .endsWith('\n',) ? '' : '\n';

  return withInsertion({
    edit,
    insertion: {
      anchor: {
        position: 'inside-table',
        table: container,
        atEnd: true,
      },
      text: `${prefix}${dottedKey} = ${valueText}\n`,
      path,
      jsValue: value,
    },
  },);
}

/**
 * Case C: extend an existing inline table with a new dotted-key entry.
 *
 * The Edit is attached to the **containing key-value** (not the inline
 * table itself) so that cross-path effective-value resolution finds the
 * new entry via the standard keyvalue lookup. This requires the inline
 * table to be the direct value of a `TOMLKeyValue`; nested inline tables
 * inside an array are rejected.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 */
function doInlineTableExtend(
  {
    edit,
    path,
    value,
    inlineTable,
    dottedSegments,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
    inlineTable: AST.TOMLInlineTable;
    dottedSegments: readonly string[];
  },
): TomlEditState {
  /** Destructured parent so the type guard can read it once. */
  const { parent, } = inlineTable;
  if ((parent === null) || (parent.type
    !== 'TOMLKeyValue')) {
    throw new TomlImmutableNodeError(
      `tomlSet at ${
        formatPath({ path, },)
      }: extending an inline table nested inside an array is not supported in v1`,
    );
  }

  assertNoInlineTableCollision({
    body: inlineTable.body,
    newSegments: dottedSegments,
    path,
  },);

  /** Encoded value text for the new entry. */
  const valueText = jsValueToTomlText({
    input: value,
    options: edit.canonical,
    existing: undefined,
  },);
  /** Dotted key spelling so each segment is encoded once. */
  const extraKey = dottedSegments
    .map(function each(s,) {
      return encodeKey({ key: s, },);
    },)
    .join('.',);

  /** Re-emitted inline-table text with the new entry appended. */
  const newText = emitInlineTableWithExtra({
    node: inlineTable,
    options: edit.canonical,
    depth: 0,
    extraKey,
    extraValue: valueText,
  },);

  /** Pre-merge JS view of the inline table; may be a non-object for malformed AST. */
  const existingJsRaw = getStaticTOMLValue(inlineTable,);
  /** Normalised to a plain object so the merge has a definite shape to extend. */
  const existingJs: Record<string, unknown> = isPlainObject(existingJsRaw,)
    ? existingJsRaw
    : {};
  /** Post-merge JS value so cross-path readers see the new shape. */
  const newJsValue = mergeDottedSegments({
    base: existingJs,
    segments: dottedSegments,
    value,
  },);

  return withEditOn({
    edit,
    node: parent,
    delta: {
      kind: 'replace-value',
      newText,
      jsValue: newJsValue,
    },
  },);
}

/**
 * Merge `value` into `base` at the chain of dotted segments, returning
 * a fresh object. Intermediate non-object slots are overwritten with
 * fresh `{}`.
 *
 * @returns Computed result (`Record<string, unknown>`).
 */
function mergeDottedSegments(
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
  if (segments.length
    === 0)
    return base;
  /** Current segment so each recursion step shrinks `segments` by one. */
  const [head,] = segments;
  if (head === undefined)
    return base;
  if (segments.length
    === 1) {
    return {
      ...base,
      [head]: value,
    };
  }
  /** Snapshot prior subtree so it can be merged into rather than overwritten. */
  const existing = base[head];
  /** Default to an empty object when the existing slot is not a plain object. */
  const child = isPlainObject(existing,) ? existing : {};
  return {
    ...base,
    [head]: mergeDottedSegments({
      base: child,
      segments: segments.slice(1,),
      value,
    },),
  };
}
