# Critic attribution: recording who raised each accepted claim

Proposal, not a ratified decision. `#65` is the task it unblocks.

## The measurement that makes the case

Taken over `pass13`'s 12 settled entries, 433 accepted issues, reading artifacts
 directly. Counts and hashes only; no corpus text was quoted anywhere in the
 measurement or in this document.

83.1% of accepted issues rest on exactly ONE deduplicated claim. The remainder
 fall away quickly: 4.2% on two claims, 3.9% on three, and a thin tail to eight.

That number is not what it looks like at first reading, and the difference is
 the whole argument. `aggregateClaims` collapses structurally identical claims
 by deterministic id BEFORE anything downstream counts them, so six critics
 emitting the same claim produce ONE `AggregatedClaim`. A cluster of size one
 therefore does not mean one critic found the defect. It means one distinct
 claim survived deduplication, and the artifact cannot say whether that claim
 came from one critic or from the whole roster agreeing exactly.

So for 83.1% of everything the pipeline accepts, the record is silent on the
 question `#65` has to answer.

Exact-place duplicates, meaning two accepted issues sharing a chunk, a category
 and a span set, account for 13.4% of accepted issues, 58 across 40 groups.

Both shares survive the concentration guard, so both are population signals
 rather than one entry's behavior:

-   Single-claim: 83.1% overall, 80.0% after dropping the largest contributor,
    per-entry spread 58% to 91%.
-   Duplicates: 13.4% overall, 13.4% after dropping the largest contributor,
    per-entry spread 5% to 26%.

A first version of this measurement reported 81.3% duplicates. It was wrong.
 `claims[i]` is an `AggregatedClaim` wrapper of shape `{ claimId, claim, }`, so
 reading `claims[0].spans` yielded `undefined` for every issue, the span key
 collapsed to a constant, and every issue in a chunk with a shared category
 looked identical. A positive control asking how many issues produced an empty
 span key returned all of them, which is what exposed it. The corrected reader
 reports zero unusable span keys.

## What the fix must not break

Adjudication is provenance-blind by deliberate design.
 `adjudicate-prompt.unit.test.ts` asserts the sheet "keeps proposer identity out
 of the sheet", and `aggregate-claims.ts:17` records the reason: a real defect
 can arrive with exactly one proposer, and the reference run had
 `gpt-oss-120b` as the sole finder of a planted seed. Proposer counts must never
 influence acceptance. Attribution is for calibration only.

This is why attribution cannot simply be a field on `IssueClaim`. It rides
 alongside, keyed by the claim id `computeIssueClaimId` already assigns.

## Shape

Collected as `Map<claimId, Map<modelId, count>>` while resolving, converted to
 sorted readonly arrays at the boundary, because a native `Map` in the outcome
 would not survive `JSON.stringify`:

```ts
// package/module/translation-repair/src/critic-attribution.ts
export type ClaimAttribution = {
  readonly claimId: string;
  readonly proposers: readonly {
    readonly modelId: SyntheticModelId;
    readonly emissionCount: number;
  }[];
};
```

The count is not decoration. `proposers.length` is independent support, how many
 distinct critics found the defect; `emissionCount` is self-repetition, one
 critic saying the same thing twice in one report. A plain `modelId[]` populated
 by appending conflates them, and `#65` is precisely the question of which of
 the two produces its duplicates.

## Where it is built and carried

Built in `runCriticStage` inside the resolution loop at
 `repair-stages.ts:181-197`, immediately after `resolution.resolved` succeeds,
 keyed by `computeIssueClaimId` over the RESOLVED claim. Not over the wire
 claim: the deterministic id is defined over the resolved form including
 anchored spans.

The input is already there. `gather.voices` carries `HeardVoice`, documented as
 "one heard voice with its speaker", and `repair-stages.ts:153` maps it to
 `voice.value`, discarding `modelId` one line after it arrives.

Carried through `CriticStageResult`, then `ChunkCriticPhase`, filtered to the
 claims surviving `screenNonTranslationVotes`, and kept local in `repairChunk`.
 `aggregateClaims` receives only claims and `runPanelStage` receives only
 clusters, both signatures unchanged. Attribution is joined onto accepted issues
 only AFTER the panel returns.

## Traps

-   **Clustering is transitive.** Claim A may overlap B and B overlap C while A
    and C do not. A cluster can hold several real defects, some accepted and
    some rejected, and the panel may decline the merge. Credit only the source
    claims the resulting accepted issue actually represents; do not union every
    cluster member's proposers onto every issue emitted from that cluster.
-   **`clusterId` is a hash of member ids**, so member ids cannot be recovered
    from it later. If the adjudicated issue does not already retain its accepted
    source claim ids, it needs them. That field carries no proposer identity and
    is safe for a provenance-blind panel.
-   **Never recompute an id after adjudication.** `computeIssueClaimId` includes
    severity and summary, and adjudication is explicitly allowed to re-grade
    severity, so an id recomputed from a re-graded issue can be absent from the
    index. Preserve the original source claim ids through adjudication.
-   **Exact identity is narrower than semantic duplication.** Different
    summaries, severities or span order give different ids by design, and
    clustering handles the semantic proximity. For duplicate accepted issues,
    attribution per source claim is what distinguishes self-repetition from
    cross-critic discovery.
-   **Accepted-only attribution is not full calibration.** It gives accepted-hit
    counts, not precision or opportunity rates. Those additionally need heard
    critic model ids rather than the bare count at `repair-stages.ts:59-62`,
    attribution for rejected resolved claims, and resolution failures tied to
    the critic that emitted them. Separate telemetry, and still never a panel
    input.

## Eligibility must be recorded, or the population is unreadable

This is the trap that outranks the rest, because it cannot be repaired after the
 fact.

A change reaches only what is recorded after it lands, exactly as the voice-loss
 telemetry does. At entry granularity that means `pass13`'s artifacts would
 split into entries written before attribution existed and entries written
 after. Any calibration averaged over that directory silently mixes a population
 where a large share of entries CANNOT contribute, and "critic X raised nothing
 in entry Y" becomes indistinguishable from "entry Y predates the map".

That is the same failure the quiet-prober finding in `#68` is about: a silent
 stage reads identically to a clean one.

So the artifact must record that attribution was AVAILABLE for the entry, not
 merely carry the map. A reader can then restrict to the eligible population
 instead of inferring absence from an empty map. Written at negligible cost;
 unrecoverable if omitted.

## Cost

A change to the cached outcome shape requires bumping `SLICE_CACHE_VERSION`
 (`repair-translation.ts:85`, currently 9), and that bump was missed on the very
 commit that added the gate, so it is worth pricing rather than assuming.

Measured: `corpus-pass.ts:566` discards an entry's slice cache the moment the
 entry settles, so the cache only ever holds in-flight work. On `pass13`, 12
 settled artifacts against a slice cache holding one entry, `GLaDOSister`, 8
 files, 216K. A bump costs one entry's partial slices.

The bump is also a design lever rather than only a cost. If attribution lives in
 the cached outcome, every post-bump slice carries it. If it does not, cache-hit
 slices silently produce no attribution, reproducing the mixed-population
 problem at slice granularity, where it is far harder to notice. It belongs in
 the cached outcome, and the version gets bumped.

`runRefinePhase` must preserve the new field wherever it reconstructs outcomes.

## Tests the change needs

-   One critic emitting an identical claim twice records that critic once with
    `emissionCount` two, not two proposers.
-   Two critics emitting an identical claim produce one deduplicated claim
    carrying both proposers.
-   A failed claim resolution produces no attribution entry.
-   Contradiction screening removes orphaned attribution.
-   Re-grading severity at adjudication retains the original source claim id.
-   A transitive cluster credits only the members the accepted issue represents.
-   A sentinel proposer model id never appears in any message passed to the
    panel client.
-   A cached outcome and a fresh outcome produce identical artifact attribution.
