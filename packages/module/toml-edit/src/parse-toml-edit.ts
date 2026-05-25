/**
 * `parseTomlEdit`: parse a source string into an immutable edit state.
 *
 * @module
 */

import {
  type AST,
  ParseError,
  parseTOML,
} from 'toml-eslint-parser';

import { TomlEditError, } from './errors.ts';
import {
  DEFAULT_CANONICAL_OPTIONS,
  type TomlEditOptions,
  type TomlEditState,
} from './types.ts';

/**
 * Parse `source` and wrap `ParseError` in a `TomlEditError`.
 *
 * @returns Computed result (`AST.TOMLProgram`).
 */
function safeParse(
  {
    source,
    tomlVersion,
  }: {
    readonly source: string;
    readonly tomlVersion: TomlEditOptions['tomlVersion'];
  },
): AST.TOMLProgram {
  try {
    return parseTOML(
      source,
      tomlVersion === undefined ? undefined : { tomlVersion, },
    );
  }
  catch (e: unknown) {
    if (e instanceof ParseError) {
      throw new TomlEditError(
        `Failed to parse TOML: ${e.message}`,
        { cause: e, },
      );
    }
    throw e;
  }
}

/**
 * Parse a TOML source string and produce a fresh `TomlEditState`.
 *
 * The returned state holds the source verbatim and the parse-time AST.
 * Both are shared by reference with every state derived from this one
 * via mutating functions; the type system marks every other field as
 * immutable.
 *
 * @param source - TOML text to parse
 *
 * @param mode - `'splice'` (default) preserves unmutated regions byte-for-byte
 *               at `tomlStringify`; `'canonical'` rebuilds text from the AST
 *               on every emit.
 *
 * @param canonical - Partial override of `CanonicalOptions`; defaults apply
 *                    for omitted fields. Used for canonical emission and for
 *                    canonical re-emission of mutated nodes in splice mode.
 *
 * @param tomlVersion - Forwarded to `toml-eslint-parser`. Defaults to the
 *                      parser's default (currently `'1.0'`).
 *
 * @returns Fresh `TomlEditState` with empty deltas.
 *
 * @throws TomlEditError when the parser rejects the input. The original
 *         `ParseError` is exposed via `cause`.
 *
 * @example
 * ```ts
 * import { parseTomlEdit, tomlStringify } from '\@monochromatic-dev/module-toml-edit';
 *
 * const edit = parseTomlEdit({ source: 'foo = "bar"\\n', },);
 * tomlStringify({ edit, },); // 'foo = "bar"\\n'
 * ```
 */
export function parseTomlEdit(
  {
    source,
    mode = 'splice',
    canonical,
    tomlVersion,
  }: TomlEditOptions,
): TomlEditState {
  /** Single parse so the AST is captured once and shared across the state's lifetime. */
  const program = safeParse({
    source,
    tomlVersion,
  },);

  return {
    source,
    program,
    edits: new Map(),
    insertions: [],
    deletions: new Set(),
    mode,
    canonical: Object.freeze({
      ...DEFAULT_CANONICAL_OPTIONS,
      ...canonical,
    },),
  };
}
