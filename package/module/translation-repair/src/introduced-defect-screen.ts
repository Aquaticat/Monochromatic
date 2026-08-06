import type { RepairRegion, } from './repair-region.ts';
import {
  type IntroducedDefectCheckWire,
  isIntroducedDefectVerdict,
} from './introduced-defect-wire.ts';

//region Introduced-defect screening
// The deterministic half of the probe. A prober claiming the edit introduced a
// defect must quote the damaged wording from the AFTER text; this module then
// decides what that quote actually proves, without asking any model.
//
// The precedent is `screenNonTranslationVotes`: deterministic evidence gets to
// DISMISS a claim it contradicts, and never has to positively prove one. There
// is no mechanical test for mistranslation, so demanding one would make the
// probe blind to the defects it exists to find. What is mechanical is the
// differential premise: a quote that already occurs in the BEFORE text cannot
// have been introduced by replacing that text, whatever the prober says.

/**
 * What the deterministic check made of one claim.
 *
 * @example
 * ```ts
 * const admissibility: ClaimAdmissibility = 'contradicted';
 * ```
 */
export type ClaimAdmissibility =
  | 'corroborated'
  | 'contradicted'
  | 'unanchored';

/**
 * One prober claim of introduced damage, after screening.
 *
 * @example
 * ```ts
 * const claim: ScreenedDefectClaim = { modelId, admissibility: 'corroborated', ... };
 * ```
 */
export type ScreenedDefectClaim = {
  /**
   * Prober that made the claim.
   */
  readonly modelId: string;

  /**
   * Defect class in the prober's words.
   */
  readonly category: string;

  /**
   * Severity as claimed, unvalidated: recorded so a later calibration can ask
   * whether probers use the vocabulary the panel uses.
   */
  readonly severity: string;

  /**
   * Wording the prober quoted from the AFTER text.
   */
  readonly evidence: string;

  /**
   * Why the prober says the BEFORE text lacked this defect.
   */
  readonly reason: string;

  /**
   * What the deterministic check made of the quote.
   */
  readonly admissibility: ClaimAdmissibility;
};

/**
 * Everything screening decided about one replaced region.
 *
 * The five counts are kept apart rather than reduced to a verdict because the
 * question this probe was built to answer is which of them a human agrees with,
 * and collapsing them now would destroy the evidence for that.
 *
 * @example
 * ```ts
 * const tally: RegionDefectTally = { envelopeId, corroborated: 1, ... };
 * ```
 */
export type RegionDefectTally = {
  /**
   * Envelope the region replaced.
   */
  readonly envelopeId: string;

  /**
   * Accepted issues the region served.
   */
  readonly issueIds: readonly string[];

  /**
   * Claims whose quote is in the AFTER text and absent from BEFORE.
   */
  readonly corroborated: number;

  /**
   * Claims whose quote already occurred in BEFORE, so the replacement cannot
   * have introduced it.
   */
  readonly contradicted: number;

  /**
   * Claims whose quote is missing or does not occur in the AFTER text, leaving
   * nothing to check them against.
   */
  readonly unanchored: number;

  /**
   * Probers that looked and reported no introduced defect.
   */
  readonly noneFound: number;

  /**
   * Probers that declined to judge this region.
   */
  readonly uncertain: number;

  /**
   * Every claim of introduced damage, screened.
   */
  readonly claims: readonly ScreenedDefectClaim[];
};

/**
 * Collapses whitespace runs to single spaces and trims, so a quote that differs
 * from the text only in wrapping still matches.
 *
 * Written as a linear scan rather than a pattern: the rule is one predicate per
 * character with one bit of carried state, which reads more plainly this way
 * and cannot backtrack over adversarial input.
 *
 * @param text - text to normalize
 *
 * @returns Text with whitespace runs collapsed
 *
 * @example
 * ```ts
 * flattenSpace({ text: 'The  cat\n naps', },);
 * ```
 */
export function flattenSpace({ text, }: { readonly text: string; },): string {
  /**
   * Characters kept so far, whitespace already collapsed.
   */
  const kept: string[] = [];
  for (const character of text) {
    if (character.trim() !== '') {
      kept.push(character,);
      continue;
    }
    if (kept.at(-1,) !== ' ')
      kept.push(' ',);
  }
  return kept.join('',)
    .trim();
}

/**
 * Decides what one quote proves about one region.
 *
 * @param evidence - wording the prober quoted
 *
 * @param region - region the claim is about
 *
 * @returns Admissibility of the claim
 *
 * @example
 * ```ts
 * const admissibility = screenEvidence({ evidence: 'the cat sleeping', region, },);
 * ```
 */
export function screenEvidence(
  {
    evidence,
    region,
  }: {
    readonly evidence: string;
    readonly region: RepairRegion;
  },
): ClaimAdmissibility {
  /**
   * Quote with whitespace collapsed, as both texts are compared.
   */
  const quoted = flattenSpace({ text: evidence, },);
  if (quoted === '')
    return 'unanchored';
  if (!flattenSpace({ text: region.editorAfter, },)
    .includes(quoted,))
    return 'unanchored';
  if (flattenSpace({ text: region.before, },)
    .includes(quoted,))
    return 'contradicted';
  return 'corroborated';
}

/**
 * Counts screened claims sharing one admissibility.
 *
 * @param claims - screened claims of one region
 *
 * @param wanted - admissibility to count
 *
 * @returns Claims carrying that admissibility
 *
 * @example
 * ```ts
 * countAdmissibility({ claims, wanted: 'contradicted', },);
 * ```
 */
function countAdmissibility(
  {
    claims,
    wanted,
  }: {
    readonly claims: readonly ScreenedDefectClaim[];
    readonly wanted: ClaimAdmissibility;
  },
): number {
  return claims.filter(function matches(claim,) {
    return claim.admissibility === wanted;
  },)
    .length;
}

/**
 * Screens every prober ballot into one tally per region.
 *
 * A check naming a region outside the sheet, or carrying a verdict outside the
 * closed vocabulary, is dropped rather than counted anywhere: it is a wire
 * fault, and folding it into `uncertain` would make schema noise look like
 * model doubt.
 *
 * @param regions - replaced regions in prompt numbering order
 *
 * @param ballots - checks per prober, keyed by model id
 *
 * @returns Tally per region, in region order
 *
 * @example
 * ```ts
 * const tallies = screenIntroducedDefects({ regions, ballots, },);
 * ```
 */
export function screenIntroducedDefects(
  {
    regions,
    ballots,
  }: {
    readonly regions: readonly RepairRegion[];
    readonly ballots: Readonly<Record<string, readonly IntroducedDefectCheckWire[]>>;
  },
): readonly RegionDefectTally[] {
  return regions.map(function toTally(
    region,
    index,
  ): RegionDefectTally {
    /**
     * Every check cast on this region, paired with its prober.
     */
    const cast = Object
      .entries(ballots,)
      .flatMap(function toChecks([
        modelId,
        checks,
      ],) {
        return checks
          .filter(function isThisRegion(check,) {
            return check.region === (index + 1);
          },)
          .map(function withSpeaker(check,) {
            return {
              modelId,
              check,
            };
          },);
      },)
      .filter(function hasKnownVerdict(entry,) {
        return isIntroducedDefectVerdict(entry.check
          .verdict,);
      },);

    /**
     * Screened claims of introduced damage on this region.
     */
    const claims = cast
      .filter(function isClaim(entry,) {
        return entry.check
          .verdict
          === 'introduced-defect';
      },)
      .map(function toClaim(entry,): ScreenedDefectClaim {
        return {
          modelId: entry.modelId,
          category: entry.check
            .category,
          severity: entry.check
            .severity,
          evidence: entry.check
            .evidence,
          reason: entry.check
            .reason,
          admissibility: screenEvidence({
            evidence: entry.check
              .evidence,
            region,
          },),
        };
      },);

    return {
      envelopeId: region.envelopeId,
      issueIds: region.issueIds,
      corroborated: countAdmissibility({
        claims,
        wanted: 'corroborated',
      },),
      contradicted: countAdmissibility({
        claims,
        wanted: 'contradicted',
      },),
      unanchored: countAdmissibility({
        claims,
        wanted: 'unanchored',
      },),
      noneFound: cast.filter(function foundNone(entry,) {
        return entry.check
          .verdict
          === 'no-introduced-defect-found';
      },)
        .length,
      uncertain: cast.filter(function declined(entry,) {
        return entry.check
          .verdict
          === 'uncertain';
      },)
        .length,
      claims,
    };
  },);
}

//endregion Introduced-defect screening
