//region Attribution report
// Reads what critic attribution recorded and turns it into rates. Built
// alongside the writer deliberately: this pipeline's recurring failure is
// telemetry that is recorded and never read, and a data path with no reader is
// indistinguishable from one that was never built.
//
// Every count here is restricted to ELIGIBLE entries, meaning artifacts that
// carry `chunkCritics` at all. Entries settled before attribution existed carry
// none, and averaging over both populations silently mixes "this critic raised
// nothing" with "this entry could not have recorded that it did".

/**
 * One critic behind one claim, as far as the report needs to read it.
 *
 * @example
 * ```ts
 * const proposer: ProposerView = { modelId: 'hf:openai/gpt-oss-120b', emissionCount: 1, };
 * ```
 */
export type ProposerView = {
  /**
   * Critic that proposed the claim.
   */
  readonly modelId: string;

  /**
   * Times it emitted the claim within its own report.
   */
  readonly emissionCount: number;
};

/**
 * Bumps one critic's counter.
 *
 * @param counter - counter to bump
 *
 * @param modelId - critic to credit
 *
 * @param by - amount to add
 *
 * @example
 * ```ts
 * bump({
          counter: heard,
          modelId,
          by: 1,
        },);
 * ```
 */
function bump(
  {
    counter,
    modelId,
    by,
  }: {
    readonly counter: Map<string, number>;
    readonly modelId: string;
    readonly by: number;
  },
): void {
  counter.set(
    modelId,
    (counter.get(modelId,) ?? 0) + by,
  );
}

/**
 * One chunk's calibration, as far as the report needs to read it.
 *
 * Structurally what `ChunkCriticRecord` is, with model ids widened to plain
 * strings. Stated independently so the reader can PARSE an artifact into this
 * without asserting unknown strings into the model-id union, and a real
 * `ChunkCriticRecord` still satisfies it.
 *
 * @example
 * ```ts
 * const view: ChunkCriticView = { chunkIndex: 0, heardCriticIds: [], claimAttributions: [], };
 * ```
 */
export type ChunkCriticView = {
  /**
   * Chunk position within the document.
   */
  readonly chunkIndex: number;

  /**
   * Critics that answered on this chunk.
   */
  readonly heardCriticIds: readonly string[];

  /**
   * Which critics raised each surviving claim.
   */
  readonly claimAttributions: readonly {
    /**
     * Deterministic identity of the claim.
     */
    readonly claimId: string;

    /**
     * Critics that proposed it.
     */
    readonly proposers: readonly ProposerView[];
  }[];
};

/**
 * One accepted issue, as far as attribution needs to read it.
 *
 * @example
 * ```ts
 * const record: AcceptedIssueView = { status: 'accepted', claimIds: ['issue/ab',], };
 * ```
 */
export type AcceptedIssueView = {
  /**
   * Adjudication status; only `accepted` counts toward hits.
   */
  readonly status: string;

  /**
   * Deterministic ids of the claims this issue represents.
   */
  readonly claimIds: readonly string[];
};

/**
 * One settled entry, as far as attribution needs to read it.
 *
 * @example
 * ```ts
 * const entry: AttributionEntry = { id: 'Acheron', chunkCritics, issues, };
 * ```
 */
export type AttributionEntry = {
  /**
   * Corpus entry identifier.
   */
  readonly id: string;

  /**
   * Per-chunk calibration, absent on entries settled before attribution
   * existed.
   */
  readonly chunkCritics?: readonly ChunkCriticView[] | undefined;

  /**
   * Adjudicated issues of this entry.
   */
  readonly issues: readonly AcceptedIssueView[];
};

/**
 * What one critic did across the eligible population.
 *
 * @example
 * ```ts
 * const tally: CriticTally = { modelId, chunksHeard: 40, claimsRaised: 12, emissions: 14, acceptedHits: 9, };
 * ```
 */
export type CriticTally = {
  /**
   * Critic this row describes.
   */
  readonly modelId: string;

  /**
   * Chunks where this critic answered; the DENOMINATOR every rate divides by.
   */
  readonly chunksHeard: number;

  /**
   * Distinct claims this critic proposed.
   */
  readonly claimsRaised: number;

  /**
   * Claims proposed counting repeats within one report, so
   * `emissions - claimsRaised` is how often this critic said a thing twice.
   */
  readonly emissions: number;

  /**
   * Accepted issues at least one of whose claims this critic proposed.
   */
  readonly acceptedHits: number;
};

/**
 * Everything the attribution reader can say about a run.
 *
 * @example
 * ```ts
 * const report = buildAttributionReport({ entries, },);
 * ```
 */
export type AttributionReport = {
  /**
   * Entries carrying attribution, which every count below is restricted to.
   */
  readonly eligibleEntries: number;

  /**
   * Entries settled before attribution existed; excluded, never counted as
   * silence.
   */
  readonly ineligibleEntries: number;

  /**
   * Chunks across eligible entries.
   */
  readonly chunks: number;

  /**
   * Per-critic rows, ordered by model id.
   */
  readonly critics: readonly CriticTally[];

  /**
   * Accepted issues whose claims came from exactly one critic.
   */
  readonly soleProposerAccepted: number;

  /**
   * Accepted issues whose claims drew more than one critic, which is
   * independent support rather than one voice repeating.
   */
  readonly multiProposerAccepted: number;

  /**
   * Accepted issues where some critic emitted the same claim more than once,
   * which is self-repetition and must not read as agreement.
   */
  readonly selfRepeatedAccepted: number;

  /**
   * Accepted issues carrying no attribution at all, which on an eligible entry
   * means a claim id the index does not hold and is a defect worth surfacing
   * rather than a zero worth averaging.
   */
  readonly unattributedAccepted: number;
};

/**
 * Indexes an entry's attributions by claim id.
 *
 * @param chunkCritics - per-chunk calibration records
 *
 * @returns Claim id to proposer list
 *
 * @example
 * ```ts
 * const index = indexProposers({ chunkCritics, },);
 * ```
 */
function indexProposers(
  {
    chunkCritics,
  }: {
    readonly chunkCritics: readonly ChunkCriticView[];
  },
): Map<string, readonly ProposerView[]> {
  /**
   * Proposers per claim across every chunk of one entry.
   */
  const index = new Map<string, readonly ProposerView[]>();
  for (const record of chunkCritics) {
    for (const attribution of record.claimAttributions)
      index.set(
        attribution.claimId,
        attribution.proposers,
      );
  }
  return index;
}

/**
 * Turns recorded attribution into per-critic rates and support counts.
 *
 * Restricted to entries carrying `chunkCritics`, because an entry settled
 * before attribution existed records no proposer for a claim its critics did
 * raise, and counting it would understate every critic at once.
 *
 * @param entries - settled entries in any order
 *
 * @returns Report over the eligible population only
 *
 * @example
 * ```ts
 * const report = buildAttributionReport({ entries, },);
 * ```
 */
export function buildAttributionReport(
  {
    entries,
  }: {
    readonly entries: readonly AttributionEntry[];
  },
): AttributionReport {
  /**
   * Entries that could record attribution at all.
   */
  const eligible = entries.filter(function carriesAttribution(entry,): boolean {
    return entry.chunkCritics !== undefined;
  },);

  /**
   * Chunks where each critic answered.
   */
  const heard = new Map<string, number>();

  /**
   * Distinct claims each critic proposed.
   */
  const raised = new Map<string, number>();

  /**
   * Claims each critic proposed, repeats included.
   */
  const emitted = new Map<string, number>();

  /**
   * Accepted issues each critic contributed a claim to.
   */
  const hits = new Map<string, number>();

  let chunks = 0;
  let soleProposerAccepted = 0;
  let multiProposerAccepted = 0;
  let selfRepeatedAccepted = 0;
  let unattributedAccepted = 0;

  for (const entry of eligible) {
    /**
     * Calibration records of this entry.
     */
    const records = entry.chunkCritics ?? [];
    chunks += records.length;

    for (const record of records) {
      for (const modelId of record.heardCriticIds)
        bump({
          counter: heard,
          modelId,
          by: 1,
        },);
      for (const attribution of record.claimAttributions) {
        for (const proposer of attribution.proposers) {
          bump({
          counter: raised,
          modelId: proposer.modelId,
          by: 1,
        },);
          bump({
            counter: emitted,
            modelId: proposer.modelId,
            by: proposer.emissionCount,
          },);
        }
      }
    }

    /**
     * Proposers of this entry's claims, by claim id.
     */
    const proposersOf = indexProposers({ chunkCritics: records, },);

    for (const issue of entry.issues) {
      if (issue.status !== 'accepted')
        continue;

      /**
       * Every critic behind any claim this accepted issue represents.
       */
      const contributors = new Set<string>();

      /**
       * Whether some critic emitted one of these claims more than once.
       */
      let repeated = false;
      for (const claimId of issue.claimIds) {
        for (const proposer of proposersOf.get(claimId,) ?? []) {
          contributors.add(proposer.modelId,);
          if (proposer.emissionCount > 1)
            repeated = true;
        }
      }

      if (contributors.size === 0) {
        unattributedAccepted += 1;
        continue;
      }
      for (const modelId of contributors)
        bump({
          counter: hits,
          modelId,
          by: 1,
        },);
      if (repeated)
        selfRepeatedAccepted += 1;
      if (contributors.size === 1)
        soleProposerAccepted += 1;
      else
        multiProposerAccepted += 1;
    }
  }

  /**
   * Every critic seen in any role, so a critic heard but silent still gets a
   * row rather than vanishing.
   */
  const modelIds = [...new Set([
    ...heard.keys(),
    ...raised.keys(),
    ...hits.keys(),
  ],),].toSorted();

  return {
    eligibleEntries: eligible.length,
    ineligibleEntries: entries.length - eligible.length,
    chunks,
    critics: modelIds.map(function toTally(modelId,): CriticTally {
      return {
        modelId,
        chunksHeard: heard.get(modelId,) ?? 0,
        claimsRaised: raised.get(modelId,) ?? 0,
        emissions: emitted.get(modelId,) ?? 0,
        acceptedHits: hits.get(modelId,) ?? 0,
      };
    },),
    soleProposerAccepted,
    multiProposerAccepted,
    selfRepeatedAccepted,
    unattributedAccepted,
  };
}

//endregion Attribution report
