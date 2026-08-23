import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import type { BenchSlice, } from './bench-sample.ts';
import type { ArmOutcome, } from './editor-width-arm.ts';
import { bothOrders, } from './editor-width-contest.ts';

//region Editor width control
// Whether the panel can see damage at all, asked before the draw spends
// anything.
//
// A null result is only evidence from an instrument shown able to produce a
// positive one. This panel is about to be asked which of two repairs of the
// same passage reads better, a fine judgement; if it cannot first prefer an
// intact passage over the same passage with a whole sentence removed, then
// "the two widths tied" means the panel is blind, not that the widths are
// equal, and an hour of calls would buy an unreadable number.
//
// RUN ON SEVERAL SLICES, not one. A single pair decided by a coin is
// indistinguishable from a panel that works, and this check exists precisely
// to not be fooled by one draw.

/**
 * Slices the control is tried on.
 *
 * Three rather than one so a single unlucky pair cannot condemn a working
 * panel, and rather than ten because this is a gate on spending, not a
 * measurement in its own right.
 */
const CONTROL_SLICES = 3;

/**
 * Sentence terminators the damage cut looks for, longest first so a full-width
 * stop is not mistaken for an ASCII one.
 */
const TERMINATORS = [
  '。',
  '. ',
  '! ',
  '? ',
];

/**
 * Removes one whole sentence, or reports that there was none to remove.
 *
 * DELETION RATHER THAN CORRUPTION is the damage of choice because `#155`
 * already names dropped page content a fault the pipeline cares about, so a
 * panel that misses it is missing something the corpus rules already say
 * matters.
 *
 * @param text - passage to damage
 *
 * @returns Passage with a sentence gone, or blank when it holds only one
 *
 * @example
 * ```ts
 * const damaged = withoutASentence(text,);
 * ```
 */
function withoutASentence(text: string,): string {
  /**
   * Index just past each terminator that appears, as a plain number so no
   * accumulator object rides through the scan.
   */
  const ends = TERMINATORS
    .map(function endOf(terminator,): number {
      /**
       * Where this terminator first appears.
       */
      const at = text.indexOf(terminator,);

      if (at === (-1))
        return text.length;

      return at + terminator.length;
    },)
    .filter(function leavesSomething(end,): boolean {
      // An end at the very end of the passage means the terminator closed the
      // only sentence, so cutting there leaves nothing to judge. That is a
      // different question from whether the panel notices a deletion, and the
      // caller filters these slices out rather than asking about them.
      return end < text.length;
    },);

  if (ends.length === 0)
    return '';

  return text
    .slice(Math.min(...ends,),)
    .trim();
}

/**
 * Presents one text as an arm, so the contest machinery can judge it.
 *
 * @param text - passage this arm offers
 *
 * @param producers - models credited with it, empty for fixture text nobody
 * wrote, which keeps every ballot at full weight
 *
 * @returns Arm the contest can seat
 *
 * @example
 * ```ts
 * const arm = asArm({ text, producers: [], },);
 * ```
 */
function asArm(
  {
    text,
    producers,
  }: {
    readonly text: string;
    readonly producers: readonly SyntheticModelId[];
  },
): ArmOutcome {
  return {
    text,
    patch: {
      patchedText: text,
      applied: [],
      rejected: [],
    },
    heard: 0,
    producers,
  };
}

/**
 * Asks whether the panel prefers intact text over text missing a sentence.
 *
 * @param client - injected model client
 *
 * @param slices - drawn sample, of which the first usable few are damaged
 *
 * @param judgeModelIds - the panel the draw will use
 *
 * @param signal - cancellation
 *
 * @param l - logger
 *
 * @returns Whether intact text won more of the tried pairs than it lost
 *
 * @example
 * ```ts
 * const held = await widthControlHolds({ client, slices, judgeModelIds, signal, l, },);
 * ```
 */
export async function widthControlHolds(
  {
    client,
    slices,
    judgeModelIds,
    signal,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly slices: readonly BenchSlice[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly l: Logger;
  }>,
): Promise<boolean> {
  /**
   * Slices with more than one sentence, which are the only ones a deletion can
   * be cut from.
   */
  const usable = slices
    .filter(function damageable(slice,) {
      return withoutASentence(slice.incumbentText,) !== '';
    },)
    .slice(
      0,
      CONTROL_SLICES,
    );

  if (usable.length === 0)
    throw new Error(
      'editor width control refused: no drawn slice holds more than one sentence, so no '
        + 'deletion could be cut and the panel was never asked anything',
    );

  /**
   * Verdict on each pair, gathered so the count is a read over results rather
   * than a counter mutated inside the loop.
   */
  const verdicts: string[] = [];

  for (const slice of usable) {
    /**
     * Intact passage, seated as the narrow arm.
     */
    const intact = asArm({
      text: slice.incumbentText,
      producers: [],
    },);

    /**
     * Same passage with a sentence gone, seated as the wide arm.
     */
    const damaged = asArm({
      text: withoutASentence(slice.incumbentText,),
      producers: [],
    },);

    /**
     * Which the panel preferred, over both seatings.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential by design: this gate exists to stop a run before it spends, so the pairs must resolve one at a time and be allowed to answer the question early
    const verdict = await bothOrders({
      client,
      input: {
        entryId: slice.entryId,
        chunkIndex: slice.index,
        sourceText: slice.sourceText,
        targetText: slice.incumbentText,
        issues: [],
        envelopes: [],
        findings: [],
      },
      narrow: intact,
      wide: damaged,
      judgeModelIds,
      signal,
      l,
    },);

    verdicts.push(verdict.verdict,);

    console.log(
      `WIDTH control ${slice.entryId} slice ${String(slice.index,)}: ${verdict.verdict}`,
    );
  }

  /**
   * Pairs where intact text won both seatings.
   */
  const intactPreferred = verdicts
    .filter(function intactWon(verdict,) {
      return verdict === 'narrow-wins';
    },)
    .length;

  // A MAJORITY RATHER THAN UNANIMITY. One pair may genuinely read better
  // shorter, and demanding a clean sweep would fail a working panel on a
  // passage whose first sentence was redundant.
  return (intactPreferred * 2) > usable.length;
}

//endregion Editor width control
