import type { CoverageReportWire, } from './coverage-wire.ts';
import { locateQuote, } from './locate-quote.ts';
import type { HeardVoice, } from './stage-quorum.ts';
import type { AnchorTarget, } from './validate-issue.ts';

//region Coverage verdict
// What a roster's coverage replies add up to, and what they are not allowed to
// add up to.
//
// THE TWO ANSWERS ARE NOT SYMMETRIC. A voice claiming the translation carries a
// passage must point at the English that carries it, and that pointing is
// checkable: the quote either occurs in the document or it does not. A voice
// claiming nothing carries it cannot exhibit anything, because absence has no
// witness. So coverage is PROVEN and absence is only ever CONCLUDED, and the
// verdict says which of the two it reached rather than flattening both into a
// boolean.
//
// AN UNANCHORABLE CLAIM IS DROPPED RATHER THAN BELIEVED, which is the same rule
// the critic stage has used since quote anchoring landed. A model that reports
// coverage and quotes English the document does not contain has either
// paraphrased what it found, which makes the quote worthless as evidence, or
// invented it. Neither is a reason to conclude the passage is carried.
//
// AND A DROPPED CLAIM IS NOT A VOTE FOR ABSENCE. It is a voice that answered
// unusably, counted apart from both sides, since treating it as agreement with
// "nothing carries this" would turn a bad quote into evidence for inserting
// text, which is the expensive direction to be wrong in.

/**
 * What a roster concluded about one passage.
 *
 * @example
 * ```ts
 * const verdict: CoverageVerdict = { kind: 'carried', ... };
 * ```
 */
export type CoverageVerdict = {
  /**
   * `carried` when a majority of usable voices anchored coverage in the
   * document; `absent` when a majority found none; `split` when neither side
   * reached a majority of the voices heard, which includes the case where too
   * many claims failed to anchor.
   */
  readonly kind: 'carried' | 'absent' | 'split';

  /**
   * Voices whose claim of coverage was found in the document.
   */
  readonly anchored: number;

  /**
   * Voices reporting nothing renders the passage.
   */
  readonly absent: number;

  /**
   * Voices claiming coverage whose quote is not in the document.
   */
  readonly unanchored: number;

  /**
   * Voices heard at all, which is the denominator of the majority rule.
   */
  readonly heard: number;

  /**
   * Anchored quotes in roster order, kept so a reader can check the verdict
   * against the document without rerunning anything.
   */
  readonly evidence: readonly string[];
};

/**
 * One voice's claim, once its quote has been looked for.
 */
type WeighedVoice = {
  /**
   * Whether it claimed any coverage at all.
   */
  readonly claimsCoverage: boolean;

  /**
   * Whether its quote was found in the document.
   */
  readonly anchored: boolean;

  /**
   * Quote it offered, kept when anchored.
   */
  readonly quote: string;
};

/**
 * Looks for one voice's quote in the translation it describes.
 *
 * @param voice - heard coverage reply
 *
 * @param document - translation the quote should occur in
 *
 * @returns That claim with its anchoring resolved
 *
 * @example
 * ```ts
 * const weighed = weighVoice({ voice, document, },);
 * ```
 */
function weighVoice(
  {
    voice,
    document,
  }: {
    readonly voice: HeardVoice<CoverageReportWire>;
    readonly document: AnchorTarget;
  },
): WeighedVoice {
  /**
   * Whether this voice says the translation carries any of the passage.
   */
  const claimsCoverage = voice.value
    .coverage
    !== 'none';
  if (!claimsCoverage) {
    return {
      claimsCoverage: false,
      anchored: false,
      quote: '',
    };
  }

  /**
   * Where its quote sits in the translation, if anywhere.
   */
  const located = locateQuote({
    document,
    side: 'target',
    quote: voice.value
      .quote,
  },);
  return {
    claimsCoverage: true,
    anchored: located.located,
    quote: voice.value
      .quote,
  };
}

/**
 * Weighs a roster's coverage replies into one verdict.
 *
 * @param voices - replies heard from the roster
 *
 * @param document - translation every quote is checked against
 *
 * @returns Verdict plus the tallies and evidence behind it
 *
 * @example
 * ```ts
 * const verdict = judgeCoverage({ voices, document, },);
 * ```
 */
export function judgeCoverage(
  {
    voices,
    document,
  }: {
    readonly voices: readonly HeardVoice<CoverageReportWire>[];
    readonly document: AnchorTarget;
  },
): CoverageVerdict {
  /**
   * Every reply with its quote resolved against the document.
   */
  const weighed = voices.map(function toWeighed(voice,): WeighedVoice {
    return weighVoice({
      voice,
      document,
    },);
  },);

  /**
   * Voices that proved coverage.
   */
  const anchored = weighed.filter(function isAnchored(claim,): boolean {
    return claim.claimsCoverage && claim.anchored;
  },);

  /**
   * Voices that claimed coverage and could not point at it.
   */
  const unanchored = weighed.filter(function isUnanchored(claim,): boolean {
    return claim.claimsCoverage && (!claim.anchored);
  },);

  /**
   * Voices reporting the passage is rendered nowhere.
   */
  const absent = weighed.filter(function isAbsent(claim,): boolean {
    return !claim.claimsCoverage;
  },);

  /**
   * Votes a side needs: more than half of every voice heard, so an unanchored
   * claim withholds a vote from both sides rather than joining either.
   */
  const majority = Math.floor(voices.length / 2,) + 1;

  /**
   * Which side, if either, reached it.
   */
  const kind = (anchored.length >= majority)
    ? 'carried'
    : ((absent.length >= majority) ? 'absent' : 'split');
  return {
    kind,
    anchored: anchored.length,
    absent: absent.length,
    unanchored: unanchored.length,
    heard: voices.length,
    evidence: anchored.map(function toQuote(claim,): string {
      return claim.quote;
    },),
  };
}

//endregion Coverage verdict
