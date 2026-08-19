import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type ClaimAttribution,
  retainAttributions,
} from './critic-attribution.ts';
import {
  computeIssueClaimId,
  type IssueClaim,
} from './issue-model.ts';
import {
  nonTranslationVotesStand,
  screenNonTranslationVotes,
} from './non-translation-evidence.ts';
import type { RepairDocument, } from './parse-document.ts';
import { runCriticStage, } from './repair-stages.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Chunk critic phase
// Critics, then the deterministic screen over their non-translation votes.
// Gathered here because the two are never useful apart: a vote count that has
// not been screened is not something any caller may act on, and keeping them
// adjacent in one module is what stops a later caller reading
// `nonTranslationVotes` straight off the critic result and blocking a slice on
// votes the evidence already contradicted.

/**
 * Everything the critic phase decided for one chunk.
 *
 * @example
 * ```ts
 * const phase = await runChunkCriticPhase({ ... },);
 * if (phase.votesStand) return unchanged;
 * ```
 */
export type ChunkCriticPhase = {
  /**
   * Validated claims surviving the screen; empty when contradicted votes took
   * their claims down with them.
   */
  readonly claims: readonly IssueClaim[];

  /**
   * Critics reporting critical non-translation at wire level, before screening.
   */
  readonly nonTranslationVotes: number;

  /**
   * Whether deterministic evidence contradicted those votes.
   */
  readonly contradicted: boolean;

  /**
   * Whether votes met the block threshold uncontradicted, so this slice must
   * ship unchanged.
   */
  readonly votesStand: boolean;

  /**
   * Critics heard, for the caller's degradation accounting.
   */
  readonly heardCritics: number;

  /**
   * WHICH critics answered, sorted by model id. Attribution counts a critic's
   * hits; this is what it was asked, so a rate can be computed rather than
   * only a tally. Unfiltered by screening, since being heard is independent of
   * whether the claims survived.
   */
  readonly heardCriticIds: readonly SyntheticModelId[];

  /**
   * Which critics raised each SURVIVING claim, keyed by deterministic claim id.
   * Already filtered to the screened claims, unlike the pre-screening list
   * `runCriticStage` returns, so a critic is never credited with a claim the
   * screen threw away. Calibration only; adjudication never sees it.
   */
  readonly claimAttributions: readonly ClaimAttribution[];

  /**
   * Critic findings plus the contradiction record when votes fell.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the critics over one chunk pair and screens their non-translation votes.
 *
 * @param client - injected model client
 *
 * @param criticModelIds - critic fan-out electorate
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text
 *
 * @param documents - parsed chunk pair claims anchor against
 *
 * @param identityContext - declared names from both sides' front matter
 *
 * @param chunkIndex - chunk position, for the dismissal warning
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Screened claims plus the vote accounting
 *
 * @example
 * ```ts
 * const phase = await runChunkCriticPhase({ ... },);
 * ```
 */
export async function runChunkCriticPhase(
  {
    client,
    criticModelIds,
    sourceText,
    targetText,
    documents,
    identityContext,
    neighbouringIncumbentText,
    neighbouringSourceText,
    chunkIndex,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly criticModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly documents: {
      readonly source: RepairDocument;
      readonly target: RepairDocument;
    };
    readonly identityContext?: string;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
    readonly chunkIndex: number;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ChunkCriticPhase> {
  /**
   * Critic fan-out result.
   */
  const critic = await runCriticStage({
    client,
    criticModelIds,
    sourceText,
    targetText,
    documents,
    ...(identityContext === undefined ? {} : { identityContext, }),
    ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
    ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Vote screening against deterministic evidence; contradicted votes fall
   * together with their claims.
   */
  const screening = screenNonTranslationVotes({
    votes: critic.nonTranslationVotes,
    claims: critic.claims,
  },);
  if (screening.contradicted) {
    l.warn(
      `chunk ${String(chunkIndex,)}: ${
        String(critic.nonTranslationVotes,)
      } non-translation votes dismissed: ${screening.findings
        .join('; ',)}`,
    );
  }

  /**
   * Identities of the claims screening left standing. Attribution is collected
   * before the screen runs, so anything dropped here must lose its attribution
   * too, or a critic keeps credit for a claim the pipeline discarded.
   */
  const survivingClaimIds = new Set(
    screening.claims
      .map(function toClaimId(claim,) {
      return computeIssueClaimId({ claim, },);
    },),
  );

  return {
    claims: screening.claims,
    nonTranslationVotes: critic.nonTranslationVotes,
    contradicted: screening.contradicted,
    votesStand: nonTranslationVotesStand({
      votes: critic.nonTranslationVotes,
      contradicted: screening.contradicted,
    },),
    heardCritics: critic.heardCritics,
    heardCriticIds: critic.heardCriticIds,
    claimAttributions: retainAttributions({
      attributions: critic.claimAttributions,
      claimIds: survivingClaimIds,
    },),
    findings: [
      ...critic.findings,
      ...screening.findings,
    ],
  };
}

//endregion Chunk critic phase
