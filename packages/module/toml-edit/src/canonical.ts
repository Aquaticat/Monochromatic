/**
 * `canonicalEmit`: rebuild TOML text from the AST + deltas.
 *
 * For `splice` mode, this is unused except for re-emitting individual mutated
 * nodes via `emit-value.ts`. For `canonical` mode, the full walk produces
 * text from scratch.
 *
 * When `program.body[0].body` is empty and no insertions are pending, the
 * canonical emitter produces just the header comment (if any) plus the
 * accumulated insertions (which is how `emptyTomlEdit` plus a chain of
 * `tomlSet`s builds a fresh file).
 *
 * AST-mutation invariant: this module never modifies AST internals.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { emitContentNode, } from './emit-value.ts';
import { spliceEmit, } from './splice.ts';
import type {
  CanonicalOptions,
  TomlEditState,
} from './types.ts';
import { encodeKey, } from './values.ts';

/**
 * Emit the canonical-mode result for the given state.
 *
 * When the underlying source already exists (canonical mode from a parsed
 * state), the splice path is the right answer because every byte from the
 * source is preserved unless explicitly mutated; canonical-mode here only
 * differs from splice-mode in how path-create insertions are placed (see
 * `splice.ts`).
 *
 * When the source is empty (from `emptyTomlEdit`), the splice path produces
 * just the concatenation of insertions, which is what we want for build-
 * from-scratch flows.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * canonicalEmit({ edit, },);
 * ```
 */
export function canonicalEmit({ edit, }: { readonly edit: TomlEditState; },): string {
  if ((edit.source
    !== '') || (edit.program
      .body[0]
      .body
      .length
      > 0))
    return spliceEmit({ edit, },);
  return canonicalFromEmpty({ edit, },);
}

/**
 * Render canonical text for an `emptyTomlEdit`-derived state.
 *
 * @returns Computed string.
 */
function canonicalFromEmpty({ edit, }: { readonly edit: TomlEditState; },): string {
  /**
   * Accumulator so the header block and insertions can be emitted in source order.
   */
  const parts: string[] = [];
  if ((edit.headerComment
    !== undefined) && (edit.headerComment
      !== '')) {
    /**
     * Header comment is stored joined; split here so each line gets its own `#` prefix.
     */
    const lines = edit.headerComment
      .split('\n',);
    for (const line of lines)
      parts.push(`# ${line}${edit.canonical
        .lineBreak}`,);
    parts.push(edit.canonical
      .lineBreak,);
  }
  /**
   * Pending insertions become the body when there is no parsed source.
   */
  const insertionTexts = edit.insertions
    .map(function each(ins,) {
    return ins.text;
  },);
  parts.push(...insertionTexts,);
  /**
   * Single join so callers see a contiguous string instead of array fragments.
   */
  const result = parts.join('',);
  if (
    edit.canonical
      .trailingNewline
      && (result !== '')
      && (!result.endsWith('\n',))
  ) {
    return `${result}${edit.canonical
      .lineBreak}`;
  }
  return result;
}

/**
 * Render a TOML key node (single or dotted) as canonical text.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * emitKey({ key: kvNode.key, },);  // e.g. 'tools.bun'
 * ```
 */
export function emitKey(
  {
    key,
  }: {
    readonly key: AST.TOMLKey;
  },
): string {
  return key
    .keys
    .map(function each(k,) {
      return encodeKey({ key: k.type
        === 'TOMLBare' ? k.name : k.value, },);
    },)
    .join('.',);
}

/**
 * Render an entire `TOMLKeyValue` as canonical text (key + ` = ` + value).
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * emitKeyValue({ keyValue: kvNode, options: canonical, },);
 * ```
 */
export function emitKeyValue(
  {
    keyValue,
    options,
  }: {
    readonly keyValue: AST.TOMLKeyValue;
    readonly options: CanonicalOptions;
  },
): string {
  return `${emitKey({ key: keyValue.key, },)} = ${
    emitContentNode({
      node: keyValue.value,
      options,
    },)
  }`;
}
