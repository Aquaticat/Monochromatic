import type { AdjudicatedIssue, } from './adjudicate-model.ts';
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
  | 'removal-corroborated'
  | 'contradicted'
  | 'unanchored'
  | 'pre-existing';

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
   * Wording the prober quoted from the AFTER text, for damage the edit added.
   */
  readonly evidence: string;

  /**
   * Wording the prober quoted from the BEFORE text, for content the edit
   * dropped; empty on claims of added damage.
   */
  readonly omittedText: string;

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
   * Claims of ADDED damage whose quote is in the AFTER text and absent from
   * BEFORE.
   */
  readonly corroborated: number;

  /**
   * Claims of DROPPED content whose quote is in the BEFORE text and absent from
   * AFTER, so the edit demonstrably removed it.
   */
  readonly removalCorroborated: number;

  /**
   * Claims the differential refutes in the direction claimed: added wording
   * that already occurred before the edit, or dropped wording still present
   * after it.
   */
  readonly contradicted: number;

  /**
   * Claims carrying no usable anchor, neither anchor, or both at once, leaving
   * nothing to check them against.
   */
  readonly unanchored: number;

  /**
   * Claims quoting wording an accepted issue already complained about, so the
   * prober is re-reporting the defect the region was cut for rather than
   * damage the edit caused.
   *
   * Counted apart from every other outcome because it is the only one that
   * says the claim is about the WRONG THING rather than wrong. Folding it into
   * `contradicted` would say the differential refuted the claim, which it did
   * not, and folding it into a damage count would credit the probe for finding
   * the defect it was told to ignore.
   */
  readonly preExisting: number;

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
 * Decides what a claim's anchors prove about one region.
 *
 * The differential runs in BOTH directions, because collateral damage comes in
 * two shapes and only one of them can be quoted from the new text. Wording the
 * edit ADDED is checkable as present in AFTER and absent from BEFORE. Wording
 * the edit DROPPED cannot be quoted from AFTER at all, since its absence is the
 * defect, and is checkable as present in BEFORE and absent from AFTER. Judging
 * only the first direction would have made every omission claim unanchored,
 * which is the failure mode worth guarding hardest against: dropping a clause
 * while rewriting is among the likeliest ways an editor causes damage.
 *
 * A claim carrying BOTH anchors is a wire fault rather than a stronger claim.
 * Screening each and taking the better answer would let a prober launder a
 * contradicted anchor by attaching a second one.
 *
 * @param evidence - wording quoted from the replacement, for added damage
 *
 * @param omittedText - wording quoted from the replaced text, for dropped
 * content
 *
 * @param region - region the claim is about
 *
 * @returns Admissibility of the claim
 *
 * @example
 * ```ts
 * const admissibility = screenEvidence({ evidence, omittedText: '', region, },);
 * ```
 */
export function screenEvidence(
  {
    evidence,
    omittedText,
    region,
  }: {
    readonly evidence: string;
    readonly omittedText: string;
    readonly region: RepairRegion;
  },
): ClaimAdmissibility {
  /**
   * Added-wording anchor, whitespace collapsed as both texts are compared.
   */
  const added = flattenSpace({ text: evidence, },);

  /**
   * Dropped-wording anchor, likewise collapsed.
   */
  const dropped = flattenSpace({ text: omittedText, },);
  if ((added === '') === (dropped === ''))
    return 'unanchored';

  /**
   * Replacement text both directions are checked against.
   */
  const after = flattenSpace({ text: region.editorAfter, },);

  /**
   * Replaced text both directions are checked against.
   */
  const before = flattenSpace({ text: region.before, },);
  if (dropped === '') {
    if (!after.includes(added,))
      return 'unanchored';
    return before.includes(added,) ? 'contradicted' : 'corroborated';
  }
  if (!before.includes(dropped,))
    return 'unanchored';
  return after.includes(dropped,) ? 'contradicted' : 'removal-corroborated';
}

/**
 * Target-side wording every accepted issue a region serves complained about.
 *
 * Read from the claims' own evidence rather than from the region, because the
 * region records what was REPLACED and an issue records what was WRONG, and a
 * replacement is routinely wider than any single complaint it answers.
 *
 * @param region - region whose served issues are collected
 *
 * @param issues - accepted issues of the chunk
 *
 * @returns Flattened target-side quotes, empty strings dropped
 *
 * @example
 * ```ts
 * const quotes = collectPriorQuotes({ region, issues, },);
 * ```
 */
function collectPriorQuotes(
  {
    region,
    issues,
  }: {
    readonly region: RepairRegion;
    readonly issues: readonly AdjudicatedIssue[];
  },
): readonly string[] {
  return issues
    .filter(function isServed(issue,) {
      return region.issueIds
        .includes(issue.issueId,);
    },)
    .flatMap(function toQuotes(issue,) {
      return issue.claims
        .flatMap(function toSpans(member,) {
          return member.claim
            .spans
            .filter(function isTargetSide(span,) {
              return span.side === 'target';
            },)
            .map(function toText(span,) {
              return flattenSpace({ text: span.quotedText, },);
            },);
        },);
    },)
    .filter(function isUsable(quote,) {
      return quote !== '';
    },);
}

/**
 * Whether an anchored verdict would otherwise count as damage the edit caused.
 *
 * The pre-existing check only ever DOWNGRADES a claim that survived the
 * differential. A contradicted claim has already been refuted mechanically, by
 * the stronger fact that its wording was present before the edit, and an
 * unanchored one quotes nothing checkable; relabelling either would replace a
 * precise verdict with a vaguer one.
 *
 * @param anchored - what the differential made of the claim
 *
 * @returns Whether the verdict is one the pre-existing check may replace
 *
 * @example
 * ```ts
 * const replaceable = countsAsDamage({ anchored: 'removal-corroborated', },);
 * ```
 */
function countsAsDamage(
  { anchored, }: { readonly anchored: ClaimAdmissibility; },
): boolean {
  return (anchored === 'corroborated') || (anchored === 'removal-corroborated');
}

/**
 * Decides whether a claim is pointing at a defect that was already reported.
 *
 * This is the defence the PROMPT used to provide by listing the accepted issues
 * and forbidding a prober from re-reporting them. Listing them measurably
 * silenced the stage: with the list shown the probe raised 2 admissible claims
 * across 45 verdicts on regions a reader called damaged, and with it withheld,
 * 18. Moving the same defence here keeps it while letting the prober look at
 * the text without being told what to excuse, which is the split
 * `screenNonTranslationVotes` already set as precedent: deterministic evidence
 * dismisses a claim rather than a prompt preventing it.
 *
 * Containment is checked BOTH ways because the two quotes are cut by different
 * parties. A critic quotes the phrase it objected to, and a prober quotes as
 * much of the surrounding wording as it thinks damaged, so neither is reliably
 * the longer one.
 *
 * @param quoted - wording the claim anchors on, already flattened
 *
 * @param priorQuotes - flattened target-side quotes of the served issues
 *
 * @returns Whether the claim restates an accepted issue
 *
 * @example
 * ```ts
 * const known = restatesPriorIssue({ quoted, priorQuotes, },);
 * ```
 */
function restatesPriorIssue(
  {
    quoted,
    priorQuotes,
  }: {
    readonly quoted: string;
    readonly priorQuotes: readonly string[];
  },
): boolean {
  if (quoted === '')
    return false;

  return priorQuotes
    .some(function overlaps(prior,) {
      return prior.includes(quoted,) || quoted.includes(prior,);
    },);
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
 * One prober's check on a region, paired with who cast it.
 *
 * Named rather than inferred from the mapping that builds it: an inferred
 * object literal carries writable properties, and every later reader of the
 * cast list then takes a mutable parameter it never mutates.
 */
type CastCheck = Readonly<{
  /**
   * Prober that cast this check.
   */
  modelId: string;

  /**
   * Check as the wire carried it.
   */
  check: IntroducedDefectCheckWire;
}>;

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
    issues = [],
  }: {
    readonly regions: readonly RepairRegion[];
    readonly ballots: Readonly<Record<string, readonly IntroducedDefectCheckWire[]>>;
    readonly issues?: readonly AdjudicatedIssue[];
  },
): readonly RegionDefectTally[] {
  return regions.map(function toTally(
    region,
    index,
  ): RegionDefectTally {
    /**
     * Wording the accepted issues of this region already complained about.
     */
    const priorQuotes = collectPriorQuotes({
      region,
      issues,
    },);
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
          .map(function withSpeaker(check,): CastCheck {
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
        /**
         * What the differential makes of this claim's anchors.
         */
        const anchored = screenEvidence({
          evidence: entry.check
            .evidence,
          omittedText: entry.check
            .omittedText,
          region,
        },);

        /**
         * Both anchors as the prober wrote them.
         */
        const {
          evidence,
          omittedText,
        } = entry.check;

        /**
         * Wording the claim anchors on, from whichever side it quoted.
         */
        const quoted = flattenSpace({
          text: omittedText === '' ? evidence : omittedText,
        },);

        return {
          modelId: entry.modelId,
          category: entry.check
            .category,
          severity: entry.check
            .severity,
          evidence: entry.check
            .evidence,
          omittedText: entry.check
            .omittedText,
          reason: entry.check
            .reason,
          admissibility: countsAsDamage({ anchored, },)
              && restatesPriorIssue({
                quoted,
                priorQuotes,
              },)
            ? 'pre-existing'
            : anchored,
        };
      },);

    return {
      envelopeId: region.envelopeId,
      issueIds: region.issueIds,
      corroborated: countAdmissibility({
        claims,
        wanted: 'corroborated',
      },),
      removalCorroborated: countAdmissibility({
        claims,
        wanted: 'removal-corroborated',
      },),
      contradicted: countAdmissibility({
        claims,
        wanted: 'contradicted',
      },),
      unanchored: countAdmissibility({
        claims,
        wanted: 'unanchored',
      },),
      preExisting: countAdmissibility({
        claims,
        wanted: 'pre-existing',
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
