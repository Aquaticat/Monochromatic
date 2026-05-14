/**
 * Dotted-key collision detection.
 *
 * Catches inserts that would produce duplicate-key parse errors on
 * re-parse. Two forms of collision are detected:
 *
 * - **Sibling-table collision**: inserting a dotted key whose new leaf
 *   path or implicit-table path overlaps a sibling explicit `TOMLTable`
 *   in `program.body[0].body`. E.g., inserting `b.c = 42` inside `[a]`
 *   while `[a.b]` exists later in the document.
 * - **Inline-table key collision**: inserting a dotted key into an inline
 *   table whose key chain is a (possibly equal) prefix of, or
 *   prefixed by, an existing inline-table entry. E.g., adding `a.b = 1`
 *   to `foo = { a = 1 }`.
 *
 * Both checks run in `tomlSet` before recording the insertion.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { TomlImmutableNodeError, } from './errors.ts';
import {
  formatPath,
  keysOf,
} from './path.ts';
import type { TomlPath, } from './types.ts';

/**
 * Throw when a dotted-key insertion at `basePath + dottedSegments` would
 * collide with any sibling `TOMLTable` in `programBody`.
 *
 * Conflict iff for some sibling resolvedKey `RK`:
 *
 * - `RK` equals the new leaf path `basePath + dottedSegments`, OR
 * - `RK` strictly extends the new leaf path (T defines a deeper child of
 *   what we are now writing as a leaf), OR
 * - `RK` equals any of the implicit-table paths the dotted key creates
 *   (`basePath + dottedSegments[0..i]` for `i` in `1..n-1`).
 *
 * @example
 * ```ts
 * assertNoSiblingTableCollision({
 *   programBody: edit.program.body[0].body,
 *   basePath: ['a',],
 *   dottedSegments: ['b','c',],
 *   path: ['a','b','c',],
 * },);
 * ```
 */
export function assertNoSiblingTableCollision(
  {
    programBody,
    basePath,
    dottedSegments,
    path,
  }: {
    programBody: readonly (AST.TOMLKeyValue | AST.TOMLTable)[];
    basePath: TomlPath;
    dottedSegments: readonly string[];
    path: TomlPath;
  },
): void {
  if (dottedSegments.length === 0) return;
  const newLeafPath: TomlPath = [
    ...basePath,
    ...dottedSegments,
  ];
  const implicitPaths: readonly TomlPath[] = Array.from(
    { length: dottedSegments.length - 1, },
    function buildImplicit(
      _v,
      i,
    ) {
      return [
        ...basePath,
        ...dottedSegments.slice(
          0,
          i + 1,
        ),
      ];
    },
  );
  for (const child of programBody) {
    if (child.type !== 'TOMLTable') continue;
    const rk = child.resolvedKey;
    if (pathsEqual({
      a: rk,
      b: newLeafPath,
    },))
      throw new TomlImmutableNodeError(
        collisionMessage({
          path,
          reason: `would redefine the existing table ${formatPath({ path: rk, },)}`,
        },),
      );
    if (startsWith({
      haystack: rk,
      needle: newLeafPath,
    },))
      throw new TomlImmutableNodeError(
        collisionMessage({
          path,
          reason: `existing table ${formatPath({ path: rk, },)} is a deeper child of the new leaf`,
        },),
      );
    for (const ip of implicitPaths)
      if (pathsEqual({
        a: rk,
        b: ip,
      },))
        throw new TomlImmutableNodeError(
          collisionMessage({
            path,
            reason: `existing table ${formatPath({ path: rk, },)} would be redefined as an implicit table`,
          },),
        );
  }
}

/**
 * Throw when an inline-table dotted-key insertion would collide with any
 * existing entry in the same inline-table body.
 *
 * Conflict iff for some existing key chain `E`:
 *
 * - `E` is a (possibly equal) prefix of `newSegments`, OR
 * - `newSegments` is a (possibly equal) prefix of `E`.
 *
 * @example
 * ```ts
 * assertNoInlineTableCollision({
 *   body: inlineTable.body,
 *   newSegments: ['a','b',],
 *   path: ['foo','a','b',],
 * },);
 * ```
 */
export function assertNoInlineTableCollision(
  {
    body,
    newSegments,
    path,
  }: {
    body: readonly AST.TOMLKeyValue[];
    newSegments: readonly string[];
    path: TomlPath;
  },
): void {
  for (const kv of body) {
    const existing = keysOf({ key: kv.key, },);
    if (
      startsWithInclusive({
        haystack: existing,
        needle: newSegments,
      },)
      || startsWithInclusive({
        haystack: newSegments,
        needle: existing,
      },)
    )
      throw new TomlImmutableNodeError(
        collisionMessage({
          path,
          reason: `existing inline-table entry ${existing.join('.',)} overlaps the new key chain ${newSegments.join('.',)}`,
        },),
      );
  }
}

/**
 * Compose a uniform collision message.
 *
 * @returns Computed string.
 */
function collisionMessage(
  {
    path,
    reason,
  }: {
    path: TomlPath;
    reason: string
  },
): string {
  return `tomlSet at ${formatPath({ path, },)} would create invalid TOML on re-parse: ${reason}`;
}

/**
 * True when `a` and `b` have identical segments.
 *
 * @returns Resulting boolean.
 */
function pathsEqual(
  {
    a,
    b,
  }: {
    a: readonly (string | number)[];
    b: TomlPath
  },
): boolean {
  if (a.length !== b.length) return false;
  return a.every(function eq(
    seg,
    i,
  ) {
    return seg === b[i];
  },);
}

/**
 * True when `haystack` strictly extends `needle` (haystack.length \> needle.length).
 *
 * @returns Resulting boolean.
 */
function startsWith(
  {
    haystack,
    needle,
  }: {
    haystack: readonly (string | number)[];
    needle: TomlPath;
  },
): boolean {
  if (haystack.length <= needle.length) return false;
  return needle.every(function eq(
    seg,
    i,
  ) {
    return seg === haystack[i];
  },);
}

/**
 * True when `needle` is a prefix of `haystack`, allowing equality.
 *
 * @returns Resulting boolean.
 */
function startsWithInclusive(
  {
    haystack,
    needle,
  }: {
    haystack: readonly (string | number)[];
    needle: readonly (string | number)[];
  },
): boolean {
  if (haystack.length < needle.length) return false;
  return needle.every(function eq(
    seg,
    i,
  ) {
    return seg === haystack[i];
  },);
}
