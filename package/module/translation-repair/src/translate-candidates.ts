import {
  type Candidate,
  mergeProducers,
  producerModelIds,
} from './candidate-select-model.ts';
import type { HeardVoice, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import type { TranslateReportWire, } from './translate-wire.ts';

//region Translate candidate assembly
// Turning heard translator voices into the slate judges compare, with the
// translation that was already there standing in it as one candidate.
//
// Ordered by ROSTER position rather than arrival, for the same reason the editor
// path is: voices come back in whatever order the provider answered, so arrival
// order would make the anonymized candidate numbering and the duplicate-collapse
// winner vary between runs over identical inputs.
//
// The incumbent is assembled FIRST, matching where `repairChunk` puts the
// unchanged text in its own two-candidate selection. That is assembly order
// rather than ballot order: `runTranslateStage` rotates the slate by a hash of
// the slice before judges see it, so the incumbent does not sit in the same
// position on every slice and its win rate is not also a measure of whatever
// position preference the judges have.

/**
 * Where one candidate translation came from.
 *
 * @example
 * ```ts
 * const origin: TranslateOrigin = 'incumbent';
 * ```
 */
export type TranslateOrigin =
  | 'incumbent'
  | 'fresh';

/**
 * One candidate translation with the fact that decides whether the slice was
 * kept or replaced.
 *
 * Origin rides on the VALUE rather than being inferred from the producer,
 * because the two answer different questions: the producer says who must not
 * judge this text, and the origin says whether shipping it changes the
 * document. They come apart exactly when a model reproduces the incumbent.
 *
 * @example
 * ```ts
 * const value: TranslateCandidateValue = { text: 'The cat naps.', origin: 'fresh', };
 * ```
 */
export type TranslateCandidateValue = {
  /**
   * Text that ships when this candidate wins.
   */
  readonly text: string;

  /**
   * Whether this text was already there.
   */
  readonly origin: TranslateOrigin;
};

/**
 * Slate judges compare, plus what building it revealed.
 *
 * @example
 * ```ts
 * const { candidates, collapsed, } = buildTranslateCandidates({ voices, ... },);
 * ```
 */
export type TranslateCandidateSet = {
  /**
   * Distinct proposals, incumbent first when it has text, then fresh
   * translations in roster order.
   */
  readonly candidates: readonly Candidate<TranslateCandidateValue>[];

  /**
   * Proposals collapsed into an earlier identical one; showing judges the same
   * text twice would only split the ballot into a spurious tie.
   */
  readonly collapsed: number;

  /**
   * Blank replies and incumbent matches, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Whether a candidate proposes any text at all.
 *
 * A reply of `{"translation": ""}` passes the wire guard, so it arrives as a
 * heard voice proposing to delete the slice. Judges cannot be shown an empty
 * candidate: it reads as a legitimate option to render nothing, and a slice
 * whose incumbent is also empty would then have a whole ballot of nothing.
 *
 * @param text - candidate text as the model returned it
 *
 * @returns Whether anything but whitespace is present
 *
 * @example
 * ```ts
 * const usable = proposesText({ text: report.translation, },);
 * ```
 */
function proposesText({ text, }: { readonly text: string; },): boolean {
  return text.trim() !== '';
}

/**
 * Key two candidates share when their texts differ only in trailing whitespace.
 *
 * Trailing newlines vary between models for reasons no judge should be asked to
 * rank, and a fresh candidate differing from the incumbent by one of them would
 * otherwise be counted as replacing it. Leading whitespace is NOT stripped,
 * since Markdown list indentation is content.
 *
 * @param text - candidate text
 *
 * @returns Comparison key
 *
 * @example
 * ```ts
 * const key = collapseKey({ text, },);
 * ```
 */
function collapseKey({ text, }: { readonly text: string; },): string {
  return text.trimEnd();
}

/**
 * Assembles the candidate slate for one slice.
 *
 * @param voices - heard translator replies in arrival order
 *
 * @param translatorModelIds - roster, fixing candidate order
 *
 * @param incumbentText - translation as it stands, blank when this slice has
 * none
 *
 * @returns Distinct candidates, how many collapsed, and what that revealed
 *
 * @example
 * ```ts
 * const set = buildTranslateCandidates({ voices, translatorModelIds, incumbentText, },);
 * ```
 */
export function buildTranslateCandidates(
  {
    voices,
    translatorModelIds,
    incumbentText,
  }: {
    readonly voices: readonly HeardVoice<TranslateReportWire>[];
    readonly translatorModelIds: readonly SyntheticModelId[];
    readonly incumbentText: string;
  },
): TranslateCandidateSet {
  /**
   * Voices sorted by roster position so candidate numbering never depends on
   * which model answered first.
   */
  const ordered = [...voices,].toSorted(function byRoster(
    left,
    right,
  ) {
    return translatorModelIds.indexOf(left.modelId,)
      - translatorModelIds.indexOf(right.modelId,);
  },);

  /**
   * Translators that answered with nothing to ship.
   */
  const blank = ordered.filter(function isBlank(voice,): boolean {
    return !proposesText({ text: voice.value
      .translation, },);
  },);

  /**
   * Every proposal worth judging: the incumbent when it has text, then each
   * translator's own rendering.
   *
   * A blank incumbent is the case this lane exists for, a passage nobody has
   * translated, and offering it as a candidate would put "leave it untranslated"
   * on the ballot.
   */
  const offered: readonly Candidate<TranslateCandidateValue>[] = [
    ...(proposesText({ text: incumbentText, },)
      ? [
        {
          producer: {
            kind: 'incumbent',
            matched: [],
          },
          value: {
            text: incumbentText,
            origin: 'incumbent',
          },
          rendered: incumbentText,
        } satisfies Candidate<TranslateCandidateValue>,
      ]
      : []),
    ...ordered
      .filter(function isUsable(voice,): boolean {
        return proposesText({ text: voice.value
          .translation, },);
      },)
      .map(function toCandidate(voice,): Candidate<TranslateCandidateValue> {
        return {
          producer: {
            kind: 'model',
            modelId: voice.modelId,
          },
          value: {
            text: voice.value
              .translation,
            origin: 'fresh',
          },
          rendered: voice.value
            .translation,
        };
      },),
  ];

  /**
   * Kept candidates by comparison key, merging the stakes of every duplicate
   * into the survivor. First seen wins the text, which puts the incumbent's
   * exact bytes on the ballot whenever a model matched it.
   */
  const byText = new Map<string, Candidate<TranslateCandidateValue>>();

  /**
   * Models whose rendering turned out to be the incumbent's, which is the
   * measurement telling a kept translation apart from an unexamined one.
   */
  const matchedIncumbent: SyntheticModelId[] = [];
  for (const candidate of offered) {
    /**
     * Key this candidate competes under.
     */
    const key = collapseKey({ text: candidate.rendered, },);

    /**
     * Earlier candidate with the same key, when one exists.
     */
    const kept = byText.get(key,);
    if (kept === undefined) {
      byText.set(
        key,
        candidate,
      );
      continue;
    }
    if (kept.value
      .origin
      === 'incumbent')
      matchedIncumbent.push(...producerModelIds(candidate.producer,),);
    byText.set(
      key,
      {
        ...kept,
        producer: mergeProducers({
          left: kept.producer,
          right: candidate.producer,
        },),
      },
    );
  }

  return {
    candidates: [...byText.values(),],
    collapsed: offered.length - byText.size,
    findings: [
      ...blank.map(function toBlankFinding(voice,): string {
        return `translate-blank (${voice.modelId})`;
      },),
      ...matchedIncumbent.map(function toMatchFinding(modelId,): string {
        return `translate-matched-incumbent (${modelId})`;
      },),
    ],
  };
}

//endregion Translate candidate assembly
