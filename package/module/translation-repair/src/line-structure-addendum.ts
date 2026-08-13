import { isLineStructured, } from './line-structure.ts';

//region Line structure addendum
// Turns the computed line-structure fact into the sentence the editor is given.
// Split from `repair-chunk` because it is a pure text decision and that file is
// at its line budget.

/**
 * Instruction added when the source slice is line-structured.
 *
 * STATED AS A FACT rather than as a condition the model must evaluate. The
 * standing rule already asks the editor to recognise line-structured text
 * itself, and an attempt to write that same recognition as a heuristic failed
 * its positive control, so leaving the judgement to a model is not obviously
 * safer than measuring it.
 *
 * SPEAKS ABOUT THE ORIGINAL, because that is the side the predicate reads. An
 * earlier wording opened `This region's CURRENT TEXT IS line-structured`, which
 * on the case this exists for is false: `Toka_ls`'s verse chunk is 21 source
 * blocks at median 22 against 18 target blocks at median 101. It told the
 * editor something untrue about the text in front of it, and then asked for one
 * output line per INPUT line, which on an already-merged translation asks for
 * the merged shape to be preserved.
 *
 * NAMES THE OBSERVED FAILURE rather than only the desired shape. The editor did
 * not merely reflow `Toka_ls`: it replaced three correctly translated lines with
 * invented text, one of them with a correct translation of a DIFFERENT line.
 * Forbidding reflow would not have covered that, so both are stated.
 */
const LINE_STRUCTURE_RULE = 'This region\'s ORIGINAL IS line-structured: each '
  + 'original line is a unit. Keep every existing line in place and in order, '
  + 'recast only within a line, and never invent a line, drop a line, or fill '
  + 'one line with content belonging to another.';

/**
 * Builds the editor rule addendum for one slice.
 *
 * MEASURED ON THE SOURCE, never the translation. The original's shape is what a
 * repair must preserve, and the translation may already have merged the lines
 * that make it verse. Measured on `Toka_ls`: its Chinese verse chunk has a
 * median node length of 22 while the English rendering of the same chunk has
 * 99, so a predicate reading the target would never fire on the case this
 * exists for.
 *
 * @param baseAddendum - configured addendum, possibly empty
 *
 * @param sourceText - original-side text of this slice
 *
 * @returns Addendum, empty when there is nothing to add
 *
 * @example
 * ```ts
 * const addendum = buildEditorAddendum({ baseAddendum: '', sourceText, },);
 * ```
 */
export function buildEditorAddendum(
  {
    baseAddendum,
    sourceText,
  }: {
    readonly baseAddendum: string;
    readonly sourceText: string;
  },
): string {
  return [
    baseAddendum,
    isLineStructured({ text: sourceText, },) ? LINE_STRUCTURE_RULE : '',
  ]
    .filter(function isPresent(part,): boolean {
    return part !== '';
  },)
    .join('\n',);
}

//endregion Line structure addendum
