import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type {
  ConsolidateGateOutcome,
  GateShipped,
} from './consolidate-gate-stage.ts';
import { wrapReplacementText, } from './semantic-wrap.ts';

//region Consolidation wrap
// APPLIES THE SEMANTIC WRAP TO A CONSOLIDATION THAT SHIPS, which is the one
// producing path with no assembly step to do it.
//
// The repair lane wraps in `repair-assemble.ts` and the translate lane in
// `translate-assemble.ts`, each at the single point its consumers read from.
// The consolidation stage has neither, so nothing re-applied the rule and
// whether a shipped consolidation carried semantic line breaks depended on
// what the producing model happened to emit.
//
// MEASURED BEFORE THIS EXISTED, across both runs of the band pair: seven of
// eleven shipped consolidations in one run and seven of twelve in the other
// lost the wrapping both lanes had, and the two runs disagreed about the same
// slice on identical inputs. `doc/planning/the-third-rendering.md` records it.
//
// DEMOTION IS RE-DERIVED RATHER THAN CARRIED, for the reason
// `wrapTranslateRecords` gives: a consolidation differing from the standing
// text only in its wrapping IS the standing text once wrapped, and shipping it
// as a consolidation would report a change nobody decided on.

/**
 * What ships for one gated slice once the wrap has been applied.
 *
 * @example
 * ```ts
 * const shipped: WrappedConsolidation = { ships: 'standing', text: 'It naps.', rewrapped: false, demoted: false, };
 * ```
 */
export type WrappedConsolidation = {
  /**
   * Rendering that ships, after a wrap that erased the difference sends the
   * slice back to its standing text.
   */
  readonly ships: GateShipped;

  /**
   * Wording that ships, wrapped when a consolidation won and untouched when
   * the standing text did.
   */
  readonly text: string;

  /**
   * Whether the wrap altered what the producer emitted, which separates a
   * producer that already wrapped from one this rule had to correct.
   */
  readonly rewrapped: boolean;

  /**
   * Whether wrapping left nothing between the consolidation and the standing
   * text, so what the gate called a change was only a re-wrapping.
   */
  readonly demoted: boolean;
};

/**
 * Wraps a winning consolidation, re-deriving whether it still changes anything.
 *
 * NEVER APPLIED TO THE STANDING TEXT. A slice the gate settled on its standing
 * text keeps that wording byte for byte: wrapping it would turn a decision to
 * change nothing into a change, which is what `wrapReplacementText` refuses by
 * contract and what the delivery coherence check refuses by measurement.
 *
 * @param outcome - what the gate settled, whose `ships` decides whether there
 * is anything to wrap
 *
 * @param consolidatedText - wording the consolidation produced, as emitted
 *
 * @param standingText - wording already in place, which a wrapped
 * consolidation may turn out to equal
 *
 * @param l - stage logger
 *
 * @returns What ships, with the wrap applied and demotion re-derived
 *
 * @example
 * ```ts
 * const shipped = wrapConsolidation({ outcome, consolidatedText, standingText, l, },);
 * ```
 */
export function wrapConsolidation(
  {
    outcome,
    consolidatedText,
    standingText,
    l,
  }: {
    readonly outcome: ConsolidateGateOutcome;
    readonly consolidatedText: string;
    readonly standingText: string;
    readonly l: Logger;
  },
): WrappedConsolidation {
  if (outcome.ships !== 'consolidated')
    return {
      ships: 'standing',
      text: standingText,
      rewrapped: false,
      demoted: false,
    };

  /**
   * Consolidation as the rule would have it written.
   */
  const wrapped = wrapReplacementText({ text: consolidatedText, },);

  /**
   * Whether the producer had already written it that way.
   */
  const rewrapped = wrapped !== consolidatedText;

  /**
   * Standing text as the rule would have written it, COMPARED AND NEVER
   * SHIPPED.
   *
   * The standing text is not always lane output. Where a lane contest settled
   * on the incumbent, what stands is the archive's own wording, which nothing
   * has ever wrapped, because wrapping a retained passage would report a
   * change nobody decided on. A consolidation that is a pure re-wrapping of
   * THAT text matches neither `standingText` nor anything else this function
   * holds, so without this key it escapes demotion and ships as a change.
   *
   * Only the comparison uses it. The demoted branch below returns
   * `standingText` itself, so the retained wording still leaves here byte for
   * byte and `wrapReplacementText`'s contract holds.
   */
  const standingAsWritten = wrapReplacementText({ text: standingText, },);

  /**
   * Whether anything but the wrapping still separates it from what stands,
   * against a standing text that may itself be wrapped or unwrapped.
   */
  const demoted = (wrapped === standingText) || (wrapped === standingAsWritten);

  if (demoted) {
    l.info(
      'semantic wrap: the consolidation matched the standing text once wrapped, so the slice keeps what it had',
    );
    return {
      ships: 'standing',
      text: standingText,
      rewrapped,
      demoted,
    };
  }

  /**
   * Lines the producer wrote, which makes a rewrap legible in a log rather
   * than a claim the reader has to take on faith.
   */
  const emittedLines = consolidatedText
    .split('\n',)
    .length;

  /**
   * Lines the rule would have it written on.
   */
  const writtenLines = wrapped
    .split('\n',)
    .length;

  if (rewrapped)
    l.info(
      `semantic wrap: rewrapped a shipped consolidation, ${String(emittedLines,)} lines as emitted `
        + `against ${String(writtenLines,)} as written`,
    );

  return {
    ships: 'consolidated',
    text: wrapped,
    rewrapped,
    demoted,
  };
}

//endregion Consolidation wrap
