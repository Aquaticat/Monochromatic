/**
 * `tomlStringify`: emit the TOML text for the current state.
 *
 * @module
 */

import { canonicalEmit, } from './canonical.ts';
import { spliceEmit, } from './splice.ts';
import type { TomlEditState, } from './types.ts';

/**
 * Emit the current state as TOML text.
 *
 * In splice mode, returns the source verbatim for unmutated regions plus
 * canonical re-emission of mutated nodes; with zero deltas the result is
 * byte-identical to the original source.
 *
 * In canonical mode, walks the AST plus deltas and produces text formatted
 * per `state.canonical`.
 *
 * @param edit - The state to emit.
 *
 * @returns The TOML output.
 *
 * @example
 * ```ts
 * const edit = parseTomlEdit({ source, },);
 * tomlStringify({ edit, },); // === source
 * ```
 */
export function tomlStringify({ edit, }: { readonly edit: TomlEditState; },): string {
  if (edit.mode
    === 'splice')
    return spliceEmit({ edit, },);
  return canonicalEmit({ edit, },);
}
