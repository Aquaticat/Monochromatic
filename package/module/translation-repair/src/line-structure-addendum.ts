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
 */
const LINE_STRUCTURE_RULE = 'This region\'s CURRENT TEXT IS line-structured: '
  + 'treat every line as a unit, keep one output line per input line in the '
  + 'same order, and recast only within a line.';

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
