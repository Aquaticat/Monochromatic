import { topLevelBlocks, } from './markdown-blocks.ts';

//region Target-only run
// ENGLISH THE ARCHIVE CARRIES THAT THE CHINESE NEVER SAID, held out of
// translation and spliced back unchanged.
//
// WHAT GOES WRONG WITHOUT THIS. The translate lane writes each slice fresh from
// its source. Where a human translator transcribed an image into the English,
// that transcript has no source counterpart, so the lane produces nothing for
// it and the shipped slice simply does not contain it. Measured on the pool
// settled 2026-08-18: `dogesir_` slice 3 went from 1766 archive characters to
// 215 shipped, losing a 1487-character transcript, and `wangzihao980` slice 4
// went from 1228 to 175, losing 1098. Both are memorial pages and the lost
// blocks are the accessible reading of an image. Nothing recovers them.
//
// THIS IS THE `A` HALF OF `#111`, whose authorized answer is "B, but best
// effort, fallback to A whenever an image's OCR doesn't make sense". `B` sends
// the image so the transcript has a source that can be CHECKED. `A` protects
// the block structurally. `A` is built first because it is what makes the
// failure of `B` survivable, and because it is correct on its own: a passage
// nobody can check is still a passage nobody may delete.
//
// THE ANCHOR IS A MARKUP BLOCK RATHER THAN A RATIO. Both measured cases end
// their source with a component, `<PhotoScroll photos={[...]} />`, which the
// archive repeats because markup is not prose. The archive then continues past
// where the source ended. So the rule is: find the last archive block that
// repeats the source's OWN LAST BLOCK, and treat what follows in the archive as
// target-only. No length ratio, no baseline, no threshold to tune.
//
// COMPARED WITH WHITESPACE COLLAPSED, and that is not a convenience. A
// byte-identical comparison was tried first and it missed `dogesir_` slice 3,
// the very case that prompted this: the source writes two spaces before `]}`
// and the archive writes one. The markup is the same markup and a copy that
// re-indented it is still a copy, so runs of whitespace are folded to one space
// on both sides before the blocks are compared. Nothing else is normalised, so
// two different components never collide.

/**
 * Separator between top-level blocks, which is a blank line.
 */
const BLOCK_SEPARATOR = '\n\n';

/**
 * Marker opening a blockquote, which every transcript in the measured
 * population is written as.
 */
const QUOTE_MARKER = '>';

/**
 * Characters that count as whitespace between blocks, named as a set so the
 * test reads as membership rather than as a chain of comparisons.
 */
const WHITESPACE: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
],);

/**
 * One slice split into the part a lane may rewrite and the part it may not.
 *
 * @example
 * ```ts
 * const split: TargetOnlySplit = { judgedText: 'The cat naps.', protectedText: '', };
 * ```
 */
export type TargetOnlySplit = {
  /**
   * Archive wording that has a source to be judged against, which is what the
   * lane translates and what the incumbent enters the ballot as.
   */
  readonly judgedText: string;

  /**
   * Archive wording the source cannot account for, empty when there is none.
   *
   * SPLICED BACK VERBATIM onto whichever wording wins, so it survives a
   * replacement and a retention alike.
   */
  readonly protectedText: string;
};

/**
 * Folds every run of whitespace in a block to a single space.
 *
 * A LINEAR SCAN rather than a pattern, per `RG1`: the rule is "runs of
 * whitespace stand as one space", which a scan states directly and in one pass
 * over the block.
 *
 * @param block - block to fold
 *
 * @returns Its text with whitespace runs folded
 *
 * @example
 * ```ts
 * const key = collapsed({ block: 'a  b', },);
 * ```
 */
function collapsed({ block, }: { readonly block: string; },): string {
  /**
   * Characters kept, with each run of whitespace standing as one space.
   */
  const out: string[] = [];

  /**
   * Whether the previous character was whitespace, so a run emits one space.
   */
  const run = { open: false, };

  for (const character of block) {
    if (WHITESPACE.has(character,)) {
      run.open = true;
      continue;
    }
    if (run.open && (out.length > 0))
      out.push(' ',);
    run.open = false;
    out.push(character,);
  }
  return out.join('',);
}

/**
 * Separates the archive wording a source can account for from what follows it.
 *
 * REQUIRES THE ANCHOR TO BE THE SOURCE'S LAST BLOCK. An identical block in the
 * middle of both documents says nothing about what comes after it, since the
 * source has more to say there too. Only an archive that continues past the end
 * of its source is carrying something the source never had.
 *
 * REQUIRES A BLOCKQUOTE IN THE RUN. Every transcript in the enumerated
 * population is written as one, and the requirement keeps an ordinary trailing
 * sentence, which a translator may legitimately reword or drop, out of the
 * protected region.
 *
 * @param sourceText - original passage
 *
 * @param incumbentText - archive wording of that passage
 *
 * @returns Wording to judge, and wording to protect
 *
 * @example
 * ```ts
 * const split = splitTargetOnlyRun({ sourceText, incumbentText, },);
 * ```
 */
export function splitTargetOnlyRun(
  {
    sourceText,
    incumbentText,
  }: {
    readonly sourceText: string;
    readonly incumbentText: string;
  },
): TargetOnlySplit {
  /**
   * Whole passage kept when nothing is protected, which is the ordinary case.
   */
  const whole: TargetOnlySplit = {
    judgedText: incumbentText,
    protectedText: '',
  };

  /**
   * Source blocks, whose last one is the only possible anchor.
   */
  const source = topLevelBlocks({ text: sourceText, },);

  /**
   * Archive blocks, among which the anchor is looked for.
   */
  const archive = topLevelBlocks({ text: incumbentText, },);

  /**
   * Source's final block, which the archive must reproduce exactly for any of
   * this to apply.
   */
  const anchor = source.at(-1,);
  if (anchor === undefined)
    return whole;

  /**
   * Archive blocks reduced to comparison keys, one per block.
   */
  const keys = archive.map(function key(block,): string {
    return collapsed({ block, },);
  },);

  /**
   * Where the archive repeats the source's last block, searched from the end so
   * a component appearing twice in one slice anchors on its last occurrence.
   */
  const anchorAt = keys.lastIndexOf(collapsed({ block: anchor, },),);
  if (anchorAt === (-1))
    return whole;

  /**
   * Archive blocks past the anchor, which no source block follows.
   */
  const trailing = archive.slice(anchorAt + 1,);
  if (trailing.length === 0)
    return whole;

  // A run carrying no blockquote is ordinary trailing prose, which a translator
  // may legitimately reword. Only a transcript is protected.
  if (!trailing.some(function isQuote(block,): boolean {
    return block.startsWith(QUOTE_MARKER,);
  },))
    return whole;

  return {
    judgedText: archive.slice(
      0,
      anchorAt + 1,
    )
      .join(BLOCK_SEPARATOR,),
    protectedText: trailing.join(BLOCK_SEPARATOR,),
  };
}

/**
 * Puts a protected run back onto whatever wording won.
 *
 * SEPARATED FROM THE SPLIT so both the replacement path and the retention path
 * go through one place: a slice that keeps the archive must end up with exactly
 * the archive's own bytes, and a slice that replaces it must end up with the new
 * wording plus the same protected run.
 *
 * @param text - wording that won
 *
 * @param protectedText - run held out of judging, possibly empty
 *
 * @returns Wording with the run restored
 *
 * @example
 * ```ts
 * const whole = restoreTargetOnlyRun({ text, protectedText, },);
 * ```
 */
export function restoreTargetOnlyRun(
  {
    text,
    protectedText,
  }: {
    readonly text: string;
    readonly protectedText: string;
  },
): string {
  if (protectedText === '')
    return text;
  return `${text}${BLOCK_SEPARATOR}${protectedText}`;
}

//endregion Target-only run
