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
 */
export function canonicalEmit({ edit, }: { edit: TomlEditState; },): string {
  if (edit.source !== '' || edit.program.body[0].body.length > 0)
    return spliceEmit({ edit, },);
  return canonicalFromEmpty({ edit, },);
}

/** Render canonical text for an `emptyTomlEdit`-derived state. */
function canonicalFromEmpty({ edit, }: { edit: TomlEditState; },): string {
  const parts: string[] = [];
  if (edit.headerComment !== null && edit.headerComment !== '') {
    const lines = edit.headerComment.split('\n',);
    for (const line of lines)
      parts.push(`# ${line}${edit.canonical.lineBreak}`,);
    parts.push(edit.canonical.lineBreak,);
  }
  const insertionTexts = edit.insertions.map(function each(ins,) {
    return ins.text;
  },);
  parts.push(...insertionTexts,);
  const result = parts.join('',);
  if (
    edit.canonical.trailingNewline
    && result !== ''
    && !result.endsWith('\n',)
  )
    return `${result}${edit.canonical.lineBreak}`;
  return result;
}

/**
 * Render a TOML key node (single or dotted) as canonical text.
 */
export function emitKey(
  {
    key,
  }: {
    key: AST.TOMLKey;
  },
): string {
  return key.keys
    .map(function each(k,) {
      return encodeKey({ key: k.type === 'TOMLBare' ? k.name : k.value, },);
    },)
    .join('.',);
}

/**
 * Render an entire `TOMLKeyValue` as canonical text (key + ` = ` + value).
 */
export function emitKeyValue(
  {
    keyValue,
    options,
  }: {
    keyValue: AST.TOMLKeyValue;
    options: CanonicalOptions;
  },
): string {
  return `${emitKey({ key: keyValue.key, },)} = ${
    emitContentNode({ node: keyValue.value, options, },)
  }`;
}
