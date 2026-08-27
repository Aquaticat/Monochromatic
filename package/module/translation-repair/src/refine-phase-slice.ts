import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import {
  neighbouringIncumbent,
  neighbouringSource,
} from './fidelity-window.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';
import {
  type refineRunShape,
  refineSliceKey,
} from './refine-slice-key.ts';
import {
  type RefinedSliceSettlement,
  settleRefinedSlice,
} from './refine-slice-settle.ts';
import type { SliceCache, } from './slice-cache.ts';
import {
  everyStageHeard,
  silentStagesOf,
} from './stage-silence.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { UnpreparedSliceError, } from './unprepared-slice.ts';

//region Refine phase slice
// Resume or buy one naturalness settlement. The document driver owns overlap
// and ordered aggregation; this boundary owns question keys, cache eligibility,
// abort-safe persistence, and every input one refinement sees.
//
// THERE IS NO IN-RUN TWIN MEMO. The former sequential phase did not have one,
// and the disk-backed cache's resumed map is a snapshot rather than a map its
// persist function mutates. Identical uncached questions therefore both buy at
// overlap one and may buy concurrently at higher overlap, preserving that rule.

/**
 * One slice as current run reports it to phase aggregation.
 *
 * @example
 * ```ts
 * const result: RefinePhaseSliceResult = { outcome, findings: [], asked: true, };
 * ```
 */
export type RefinePhaseSliceResult = RefinedSliceSettlement & {
  /**
   * Whether current run reached a rewriter for this slice.
   */
  readonly asked: boolean;
};

/**
 * Persists one naturalness settlement only when caller remains live and every
 * stage reached quorum.
 *
 * Separated from model work so abort-safe persistence is directly testable:
 * transport usually throws before settlement returns, which otherwise makes
 * this final defense unreachable in a model-client fixture.
 *
 * @param key - exact question this settlement answers
 *
 * @param settled - outcome and findings eligible for serialization
 *
 * @param sliceIndex - index named in refusal warning
 *
 * @param refineCache - naturalness persistence boundary, when configured
 *
 * @param signal - caller abort checked before write
 *
 * @param l - phase logger receiving eligibility warning
 *
 * @throws Whatever caller abort reason or persistence throws
 *
 * @example
 * ```ts
 * await persistRefinePhaseSlice({ key, settled, sliceIndex, refineCache, signal, l, },);
 * ```
 *
 * @internal
 */
export async function persistRefinePhaseSlice(
  {
    key,
    settled,
    sliceIndex,
    refineCache,
    signal,
    l,
  }: ForeignBorrowed<{
    readonly key: string;
    readonly settled: RefinedSliceSettlement;
    readonly sliceIndex: number;
    readonly refineCache?: SliceCache<RefinedSliceSettlement>;
    readonly signal: AbortSignal;
    readonly l: Logger;
  }>,
): Promise<void> {
  signal.throwIfAborted();

  if (everyStageHeard({ findings: settled.findings, },)) {
    await refineCache?.persist({
      key,
      serialized: JSON.stringify({
        outcome: settled.outcome,
        findings: settled.findings,
      } satisfies RefinedSliceSettlement,),
    },);
    return;
  }

  /**
   * Stages whose silence makes this settlement ineligible for reuse.
   */
  const silent = silentStagesOf({ findings: settled.findings, },)
    .join('; ',);
  l.warn(
    `slice ${String(sliceIndex,)}: a stage heard fewer than quorum, so the refinement is NOT cached: ${
      silent
    }`,
  );
}

/**
 * Resumes or buys one naturalness settlement and persists only decisions a warm
 * run may reuse.
 *
 * @param client - injected model client
 *
 * @param outcome - accuracy settlement this slice refines
 *
 * @param slices - prepared pairs used to refuse unknown indices and derive
 * neighbouring fidelity window
 *
 * @param models - stage rosters deciding rewrite and checks
 *
 * @param refinerModelIds - already-validated non-empty rewriter roster
 *
 * @param runShape - model-facing governance folded into cache key
 *
 * @param definitions - whole-document references rewriter and guards resolve
 *
 * @param identityContext - declared identities model prompts preserve
 *
 * @param declaredNames - exact declarations deterministic guard preserves
 *
 * @param refineCache - prior settlements and persistence boundary
 *
 * @param signal - caller abort checked before any persistence
 *
 * @param perCallTimeoutMs - per-exchange deadline
 *
 * @param l - phase logger receiving cache-refusal warning
 *
 * @returns Slice outcome and findings plus whether current run asked rewriters
 *
 * @throws UnpreparedSliceError when outcome index has no prepared pair
 *
 * @throws Whatever settlement, persistence, or caller abort throws
 *
 * @example
 * ```ts
 * const settled = await settleRefinePhaseSlice({
 *   client,
 *   outcome,
 *   slices,
 *   models,
 *   refinerModelIds,
 *   runShape,
 *   definitions,
 *   declaredNames,
 *   signal,
 *   perCallTimeoutMs,
 *   l,
 * },);
 * ```
 *
 * @internal
 */
export async function settleRefinePhaseSlice(
  {
    client,
    outcome,
    slices,
    models,
    refinerModelIds,
    runShape,
    definitions,
    identityContext,
    declaredNames,
    refineCache,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly outcome: ChunkRepairOutcome;
    readonly slices: readonly ChunkPair[];
    readonly models: RepairModels;
    readonly refinerModelIds: readonly RosterModelId[];
    readonly runShape: ReturnType<typeof refineRunShape>;
    readonly definitions: string;
    readonly identityContext?: string;
    readonly declaredNames: readonly string[];
    readonly refineCache?: SliceCache<RefinedSliceSettlement>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RefinePhaseSliceResult> {
  /**
   * Prepared pair this outcome claims to settle.
   */
  const prepared = slices[outcome.sliceIndex];
  if (prepared === undefined)
    throw new UnpreparedSliceError({ sliceIndex: outcome.sliceIndex, },);

  /**
   * Source wording serving as faithfulness anchor.
   */
  const sourceText = prepared.source
    .text;

  /**
   * Archive wording deciding whether returned text changed this slice.
   */
  const incumbentText = prepared.target
    .text;

  /**
   * Nearby original and archive passages used by damage probe.
   */
  const windowFragment = {
    neighbouringSourceText: neighbouringSource({
      slices,
      slicePosition: outcome.sliceIndex,
    },),
    neighbouringIncumbentText: neighbouringIncumbent({
      slices,
      slicePosition: outcome.sliceIndex,
    },),
  };

  /**
   * Exact refinement question this settlement answers.
   */
  const key = refineSliceKey({
    runShape,
    sourceText,
    repairedText: outcome.repairedText,
    incumbentText,
    definitions,
    declaredNames,
    issues: outcome.issues,
    resolvedIssueIds: outcome.resolvedIssueIds,
    nonTranslationStanding: outcome.nonTranslationStanding,
    ...windowFragment,
  },);

  /**
   * Earlier decision for same question, when cache carries one.
   */
  const stored = refineCache?.resumed
    .get(key,);
  if (stored !== undefined) {
    return {
      outcome: stored.outcome,
      findings: stored.findings,
      asked: false,
    };
  }

  /**
   * Decision bought by current run.
   */
  const settled = await settleRefinedSlice({
    client,
    outcome,
    sourceText,
    incumbentText,
    definitions,
    models,
    refinerModelIds,
    ...(identityContext === undefined ? {} : { identityContext, }),
    declaredNames,
    ...windowFragment,
    signal,
    perCallTimeoutMs,
    l,
  },);

  // An abandoned exchange must never become warm-run evidence, even if a later
  // settlement path converts transport failure into stage silence.
  await persistRefinePhaseSlice({
    key,
    settled,
    sliceIndex: outcome.sliceIndex,
    ...((refineCache === undefined) ? {} : { refineCache, }),
    signal,
    l,
  },);

  return {
    outcome: settled.outcome,
    findings: settled.findings,
    asked: settled.asked,
  };
}

//endregion Refine phase slice
