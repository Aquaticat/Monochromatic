import { hashContent, } from './document-node.ts';
import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Refine slice key
// What makes two runs' refinements the SAME refinement, for cache purposes.
//
// Split from the phase for the reason `consolidate-key.ts` gives: the key is the
// one piece of a stage testable without a client, and a reader of the phase does
// not want the cache reasoning in the middle of it.
//
// WHY THIS CACHE EXISTS AT ALL. The naturalness lane runs after the accuracy
// pass has already persisted its slices, and it was never cached, so a resumed
// run replayed the accuracy pass from disk and then bought the whole lane again
// with fresh model calls. Measured across the band pair, that published
// different text at 7 of 18 repair-lane slices on identical inputs.
//
// AND WHY MARKING THE OUTCOME WOULD NOT HAVE DONE. `refine-phase.ts` records
// `refined: true` only where a rewrite both changed the text and kept every
// confirmed issue, so the flag reads false both for a slice refinement declined
// and for a slice refinement never saw. Skipping on that flag would still rebuy
// the lane at exactly the slices that flipped between runs, which is where the
// divergence came from. Only a key over the question can settle it.

/**
 * Generation of the refinement cache.
 *
 * MOVES WHEN THE QUESTION MOVES: the rewriter sheet, the judge sheet, the
 * envelope derivation, the retention recheck, or the introduced-defect probe.
 * Each of those changes what a voice is asked or how its answer is read.
 *
 * IT MOVES FOR THE PROBE TOO, which is the case worth naming. The probe is
 * shadow telemetry and decides nothing, but its findings ride in the cached
 * record, so a resumed slice would otherwise carry an audit the current prober
 * never performed.
 *
 * MOVED TO 2 WHEN THE PROBE GAINED ITS WINDOW. The two nearby fields below
 * already change every key that carries one, so this bump decides nothing on
 * its own; it is here because the rule above says the version moves when the
 * probe's question moves, and a reader checking that rule against this change
 * has to find it kept rather than argued around. It also covers the slices
 * whose window is empty, which the fields deliberately cannot.
 */
export const REFINE_CACHE_VERSION = 2;

/**
 * Everything about this run that changes what the voices are ASKED.
 *
 * Without it a resumed slice could return a rewrite reached by a different
 * roster and nothing would look wrong, since the texts match and so the key
 * matches.
 *
 * THE CHECKERS BELONG HERE even though they never rewrite anything. They decide
 * whether a refinement is rolled back for breaking a confirmed issue, so a
 * different checker roster can ship a rewrite this one refused.
 *
 * `perCallTimeoutMs` is deliberately ABSENT, on the reasoning every other lane
 * gives: it changes how long a voice has to answer, not what it is asked.
 *
 * @param refinerModelIds - voices asked to rewrite
 *
 * @param judgeModelIds - voices asked which rewrite wins
 *
 * @param checkerModelIds - voices deciding whether a rewrite kept what was
 * already proved, and auditing what it damaged
 *
 * @param identityContext - names and handles both documents declare
 *
 * @returns Stable string for the key
 *
 * @example
 * ```ts
 * const runShape = refineRunShape({ refinerModelIds, judgeModelIds, checkerModelIds, identityContext, },);
 * ```
 */
export function refineRunShape(
  {
    refinerModelIds,
    judgeModelIds,
    checkerModelIds,
    identityContext,
  }: {
    readonly refinerModelIds: readonly RosterModelId[];
    readonly judgeModelIds: readonly RosterModelId[];
    readonly checkerModelIds: readonly RosterModelId[];
    readonly identityContext?: string;
  },
): string {
  return JSON.stringify([
    refinerModelIds,
    judgeModelIds,
    checkerModelIds,
    identityContext ?? '',
  ],);
}

/**
 * Cross-run key for one refined slice.
 *
 * THE DEFINITIONS ARE IN IT, which is what separates this key from the accuracy
 * pass's own. `refine-phase.ts` collects link and footnote definitions from the
 * WHOLE assembled document so a paragraph's references resolve while it is being
 * gated, which means a neighbouring slice settling differently changes what this
 * slice's rewriter is shown. That is the window lesson `#126` records: a
 * per-slice key omitting context the model saw resumes a stale rewrite after a
 * neighbour moves.
 *
 * THE ISSUES ARE IN IT WHOLE rather than as identifiers. Their text is shown to
 * the checkers deciding whether a rewrite kept what was already proved, so two
 * slices carrying the same issue identifiers over different wording are not the
 * same question.
 *
 * THE SLICE INDEX IS NOT IN IT, matching every other lane. Where a slice sits
 * changes nothing a voice is asked, and keeping the index would discard every
 * settled refinement after a renumbering.
 *
 * THE INCUMBENT IS IN IT THOUGH IT REACHES NO PROMPT, which reads like a
 * mistake until the stored record is read. No rewriter, judge or checker is
 * ever shown the archive wording. The RECORD is computed from it:
 * `settleRefinedSlice` sets `changed` by comparing its rewrite against the
 * incumbent, and drops `resolvedIssueIds` wherever the two match, so two runs
 * over one source and one repaired text but different archive wording settle
 * differently and would otherwise share a key. `consolidate-key.ts` covers the
 * standing text for the same reason.
 *
 * NOTHING PINS THE INCUMBENT TO THE REPAIRED TEXT one to one. Even where no
 * current path yields a moved incumbent under an unchanged repaired text, that
 * is a coincidence of what other stages happen to do rather than an invariant
 * anything asserts, and what it leaves is not a self-healing rebuy:
 * `repair-refine-step.ts` throws on any resumed slice whose stored `changed`
 * disagrees with the incumbent the current run computed.
 *
 * @param runShape - what this run asks, from {@link refineRunShape}
 *
 * @param sourceText - slice original, which is the faithfulness anchor
 *
 * @param repairedText - what the accuracy pass settled, which is what gets
 * rewritten and what the probe measures damage against
 *
 * @param incumbentText - archive wording a rewrite may land back on, which
 * reaches no prompt and decides both the stored `changed` flag and the
 * resolutions that flag gates
 *
 * @param definitions - link and footnote definitions of the assembled document,
 * which vary with what every OTHER slice settled
 *
 * @param declaredNames - attributions a rewrite may not invent or drop
 *
 * @param issues - claims the accuracy pass filed, shown to the checkers
 *
 * @param resolvedIssueIds - subset the checkers had already confirmed, which
 * decides what a rollback is measured against
 *
 * @param nonTranslationStanding - whether critics ruled this slice untranslated,
 * which skips the lane outright
 *
 * @param neighbouringSourceText - original of the passages either side, shown to
 * the probe auditing what this rewrite damaged. In the key because a rewrite
 * audited against its neighbours was asked a different question from the same
 * rewrite audited alone, and the audit rides in the cached record
 *
 * @param neighbouringIncumbentText - archive English of those same two, which is
 * the half a relocation shows
 *
 * @returns Hash keying this slice's refinement
 *
 * @example
 * ```ts
 * const key = refineSliceKey({ runShape, sourceText, repairedText, incumbentText, definitions, declaredNames, issues, resolvedIssueIds, nonTranslationStanding, },);
 * ```
 */
export function refineSliceKey(
  {
    runShape,
    sourceText,
    repairedText,
    incumbentText,
    definitions,
    declaredNames,
    issues,
    resolvedIssueIds,
    nonTranslationStanding,
    neighbouringSourceText,
    neighbouringIncumbentText,
  }: {
    readonly runShape: string;
    readonly sourceText: string;
    readonly repairedText: string;
    readonly incumbentText: string;
    readonly definitions: string;
    readonly declaredNames: readonly string[];
    readonly issues: readonly AdjudicatedIssue[];
    readonly resolvedIssueIds: readonly string[];
    readonly nonTranslationStanding: boolean;
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      'refine',
      REFINE_CACHE_VERSION,
      runShape,
      sourceText,
      repairedText,
      incumbentText,
      definitions,
      declaredNames,
      issues,
      resolvedIssueIds,
      nonTranslationStanding,
      // ABSENT AND EMPTY KEY ALIKE, matching `repairSliceKey` and for the same
      // reason: `introduced-defect-wire.ts` renders no nearby block for either,
      // so a slice with no neighbours is asked exactly what a caller without
      // the parameter asked and should resume rather than be rebought to reach
      // the identical answer.
      //
      // LABELLED for the reason `#126` records. Spread bare into a positional
      // array, a source-only window and an incumbent-only window carrying the
      // same text hash identically, and one cached audit would then serve two
      // different questions. Asymmetric windows are real: a neighbour that is
      // an insertion anchor has source text and no archive text.
      ...(((neighbouringSourceText === undefined) || (neighbouringSourceText === ''))
        ? []
        : [
          'nearby-source',
          neighbouringSourceText,
        ]),
      ...(((neighbouringIncumbentText === undefined) || (neighbouringIncumbentText === ''))
        ? []
        : [
          'nearby-incumbent',
          neighbouringIncumbentText,
        ]),
    ],),
  },);
}

//endregion Refine slice key
