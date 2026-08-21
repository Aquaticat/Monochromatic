import { hashContent, } from './document-node.ts';
import type { IncumbentKind, } from './translate-absence.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Lane contest key
// What makes two runs` contests the SAME contest, for cache purposes.
//
// Split from the driver for the same reasons `repair-slice-key.ts` and
// `translate-slice-key.ts` were: the key is the one piece of a driver that can
// be tested without a client, and a reader of the driver does not want the
// cache reasoning in the middle of it.

/**
 * Generation of the contest cache.
 *
 * MOVES WHEN THE QUESTION MOVES: the prompt, the schema, the ballot reader, the
 * quorum, or anything else that changes what a judge is asked or how its answer
 * is read. It does NOT move for a change to how a settled outcome is RECORDED,
 * since the ballots on disk still answer the question that bought them.
 */
export const LANE_CONTEST_CACHE_VERSION = 1;

/**
 * Everything about this run that changes what the judges are ASKED, folded into
 * every contest key.
 *
 * Without it a resumed slice could return ballots cast by a different roster,
 * and nothing would look wrong: the texts match, so the key matches. Identity
 * context belongs here for the same reason, since it is front-matter-derived
 * prompt content that varies per pair and measurably changes the answer.
 *
 * `perCallTimeoutMs` is deliberately ABSENT, on the same reasoning the other
 * two lanes give: it changes how long a voice has to answer, not what it is
 * asked, and including it would discard every settled contest on a deadline
 * change.
 *
 * @param modelIds - roster asked to judge
 *
 * @param identityContext - names and handles both documents declare
 *
 * @returns Stable string for the key
 *
 * @example
 * ```ts
 * const runShape = laneContestRunShape({ modelIds, identityContext, },);
 * ```
 */
export function laneContestRunShape(
  {
    modelIds,
    identityContext,
  }: {
    readonly modelIds: readonly SyntheticModelId[];
    readonly identityContext?: string;
  },
): string {
  return JSON.stringify([
    modelIds,
    identityContext ?? '',
  ],);
}

/**
 * Cross-run key for one contested slice.
 *
 * THE SLICE INDEX IS NOT IN IT, matching both lanes. A key is what makes two
 * runs` slices the same slice, and what a contest judge is asked is the
 * original, the archive rendering and the two candidates. Where the slice
 * happens to sit changes none of it, and keeping the index would discard every
 * settled contest after any renumbering.
 *
 * THE ARCHIVE RENDERING IS IN IT even though the contest never ships it. The
 * judge is shown it as evidence about what the passage has said before, so two
 * contests over identical candidates and different archive wording are not the
 * same question.
 *
 * @param runShape - what this run asks, from {@link laneContestRunShape}
 *
 * @param sourceText - slice original, which is the standard
 *
 * @param incumbentText - archive rendering shown as evidence
 *
 * @param incumbentKind - whether the archive has wording here at all
 *
 * @param repairText - what the repair lane would ship
 *
 * @param translateText - what the translate lane would ship
 *
 * @returns Hash keying this slice`s ballots
 *
 * @example
 * ```ts
 * const key = laneContestSliceKey({ runShape, sourceText, incumbentText, incumbentKind, repairText, translateText, },);
 * ```
 */
export function laneContestSliceKey(
  {
    runShape,
    sourceText,
    incumbentText,
    incumbentKind,
    repairText,
    translateText,
  }: {
    readonly runShape: string;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly incumbentKind: IncumbentKind;
    readonly repairText: string;
    readonly translateText: string;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      'lane-contest',
      LANE_CONTEST_CACHE_VERSION,
      runShape,
      sourceText,
      incumbentKind,
      incumbentText,
      repairText,
      translateText,
    ],),
  },);
}

//endregion Lane contest key
