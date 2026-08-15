import type {
  CoverageDegree,
  CoverageReportWire,
} from './coverage-wire.ts';
import { locateQuote, } from './locate-quote.ts';
import type { HeardVoice, } from './stage-quorum.ts';
import type { AnchorTarget, } from './validate-issue.ts';

//region Coverage verdict
// What a roster's coverage replies add up to, and what they are not allowed to
// add up to.
//
// THE TWO ANSWERS ARE NOT SYMMETRIC. A voice claiming the translation carries a
// passage must point at the English that carries it, and that pointing is
// checkable. A voice claiming nothing carries it cannot exhibit anything,
// because absence has no witness. So the verdict says which of the two it
// reached rather than flattening both into a boolean.
//
// WHAT AN ANCHORED QUOTE PROVES IS PROVENANCE, NOT CORRESPONDENCE, and that
// distinction is measured rather than theoretical: on one corpus section two of
// six voices claimed coverage and quoted a real sentence belonging to a
// different passage of the same document. Locating a quote proves those words
// occur; it does not prove they render the passage that was asked about. The
// tallies here are therefore evidence, not proof, and `#106` records the second
// field that would close the gap.
//
// AN UNANCHORABLE CLAIM IS DROPPED RATHER THAN BELIEVED, the same rule the
// critic stage has used since quote anchoring landed, AND IT IS NOT A VOTE FOR
// ABSENCE. Treating it as agreement with "nothing carries this" would turn a
// bad quote into evidence for inserting text, which is the expensive direction.
//
// THE THRESHOLD IS THE ROSTER, NOT THE VOICES HEARD, which is the correction a
// review made after the first measurement. Counting a majority of those who
// answered means silence LOWERS the bar: one voice heard saying it found
// nothing decided absence, with five models lost and quorum unmet. Silence is
// then more dangerous than a fabricated quote, which is backwards. A verdict now
// needs a majority of every model asked, and an unmet quorum is inconclusive
// whatever the answers say.

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
   * `carried` when a majority of the ROSTER anchored full coverage;
   * `partly-carried` when a majority anchored coverage but not all of it, which
   * still forbids inserting the passage whole;
   * `absent` when a majority found none;
   * `split` when neither side reached a majority of the roster;
   * `inconclusive` when too few models answered to decide anything.
   */
  readonly kind: 'carried' | 'partly-carried' | 'absent' | 'split' | 'inconclusive';

  /**
   * Voices that anchored FULL coverage in the document.
   */
  readonly anchoredFull: number;

  /**
   * Voices that anchored partial coverage.
   */
  readonly anchoredPartial: number;

  /**
   * Voices reporting nothing renders the passage.
   */
  readonly absent: number;

  /**
   * Voices claiming coverage whose quote is not in the document.
   */
  readonly unanchored: number;

  /**
   * Voices heard at all.
   */
  readonly heard: number;

  /**
   * Models asked, which is what the majority is taken over.
   */
  readonly asked: number;

  /**
   * Anchored quotes in roster order, kept so a reader can check the verdict
   * against the document without rerunning anything.
   */
  readonly evidence: readonly string[];

  /**
   * Quotes that were claimed and not found, kept because a near miss and an
   * invention are different failures and the counts alone cannot tell them
   * apart.
   */
  readonly unanchoredQuotes: readonly string[];
};

/**
 * One voice's claim, once its quote has been looked for.
 */
type WeighedVoice = {
  /**
   * How much coverage it claimed.
   */
  readonly degree: CoverageDegree;

  /**
   * Whether its quote was found in the document.
   */
  readonly anchored: boolean;

  /**
   * Quote it offered, empty when it claimed no coverage.
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
   * How much of the passage this voice says the translation carries.
   */
  const degree = voice.value
    .coverage;
  if (degree === 'none') {
    return {
      degree,
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
    degree,
    anchored: located.located,
    quote: voice.value
      .quote,
  };
}

/**
 * Whether a claim proved full coverage.
 *
 * @param claim - weighed reply
 *
 * @returns Whether it claimed full coverage and its quote was found
 *
 * @example
 * ```ts
 * const full = isFull(claim,);
 * ```
 */
function isFull(claim: WeighedVoice,): boolean {
  return (claim.degree === 'full') && claim.anchored;
}

/**
 * Whether a claim proved partial coverage.
 *
 * @param claim - weighed reply
 *
 * @returns Whether it claimed partial coverage and its quote was found
 *
 * @example
 * ```ts
 * const partial = isPartial(claim,);
 * ```
 */
function isPartial(claim: WeighedVoice,): boolean {
  return (claim.degree === 'partial') && claim.anchored;
}

/**
 * Whether a claim reported no coverage at all.
 *
 * @param claim - weighed reply
 *
 * @returns Whether it found nothing
 *
 * @example
 * ```ts
 * const absent = isAbsent(claim,);
 * ```
 */
function isAbsent(claim: WeighedVoice,): boolean {
  return claim.degree === 'none';
}

/**
 * Whether a claim of coverage could not be found in the document.
 *
 * @param claim - weighed reply
 *
 * @returns Whether it claimed coverage and its quote was absent
 *
 * @example
 * ```ts
 * const unanchored = isUnanchored(claim,);
 * ```
 */
function isUnanchored(claim: WeighedVoice,): boolean {
  return (claim.degree !== 'none') && (!claim.anchored);
}

/**
 * Whether a claim was found in the document.
 *
 * @param claim - weighed reply
 *
 * @returns Whether its quote was located
 *
 * @example
 * ```ts
 * const anchored = isAnchored(claim,);
 * ```
 */
function isAnchored(claim: WeighedVoice,): boolean {
  return claim.anchored;
}

/**
 * Reads one claim's quote.
 *
 * @param claim - weighed reply
 *
 * @returns Quote it offered
 *
 * @example
 * ```ts
 * const quote = claimQuote(claim,);
 * ```
 */
function claimQuote(claim: WeighedVoice,): string {
  return claim.quote;
}

/**
 * Counts the weighed voices matching one predicate.
 *
 * @param weighed - every reply with its anchoring resolved
 *
 * @param matches - predicate deciding membership
 *
 * @returns How many match
 *
 * @example
 * ```ts
 * const absent = countVoices({ weighed, matches: isAbsent, },);
 * ```
 */
function countVoices(
  {
    weighed,
    matches,
  }: {
    readonly weighed: readonly WeighedVoice[];
    readonly matches: (claim: WeighedVoice,) => boolean;
  },
): number {
  return weighed.filter(matches,)
    .length;
}

/**
 * Weighs a roster's coverage replies into one verdict.
 *
 * @param voices - replies heard from the roster
 *
 * @param document - translation every quote is checked against
 *
 * @param asked - models the question went to, which the majority is taken over
 *
 * @param quorumMet - whether enough of them answered to decide at all
 *
 * @returns Verdict plus the tallies and evidence behind it
 *
 * @example
 * ```ts
 * const verdict = judgeCoverage({ voices, document, asked: 6, quorumMet: true, },);
 * ```
 */
export function judgeCoverage(
  {
    voices,
    document,
    asked,
    quorumMet,
  }: {
    readonly voices: readonly HeardVoice<CoverageReportWire>[];
    readonly document: AnchorTarget;
    readonly asked: number;
    readonly quorumMet: boolean;
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
   * Voices that proved full coverage.
   */
  const anchoredFull = countVoices({
    weighed,
    matches: isFull,
  },);

  /**
   * Voices that proved partial coverage.
   */
  const anchoredPartial = countVoices({
    weighed,
    matches: isPartial,
  },);

  /**
   * Voices reporting the passage is rendered nowhere.
   */
  const absent = countVoices({
    weighed,
    matches: isAbsent,
  },);

  /**
   * Votes a side needs: more than half of every model ASKED, so a lost voice
   * withholds a vote rather than lowering the bar.
   */
  const majority = Math.floor(asked / 2,) + 1;

  /**
   * Voices proving coverage of any degree, which is what forbids inserting the
   * passage whole.
   */
  const anchoredAny = anchoredFull + anchoredPartial;

  /**
   * Which side, if either, reached the threshold.
   */
  const decided = (anchoredFull >= majority)
    ? 'carried'
    : ((anchoredAny >= majority)
      ? 'partly-carried'
      : ((absent >= majority) ? 'absent' : 'split'));
  return {
    kind: quorumMet ? decided : 'inconclusive',
    anchoredFull,
    anchoredPartial,
    absent,
    unanchored: countVoices({
      weighed,
      matches: isUnanchored,
    },),
    heard: voices.length,
    asked,
    evidence: weighed.filter(isAnchored,)
      .map(claimQuote,),
    unanchoredQuotes: weighed.filter(isUnanchored,)
      .map(claimQuote,),
  };
}

//endregion Coverage verdict
