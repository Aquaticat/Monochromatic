import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { ArchiveDispute, } from '../archive-dispute.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { DeclaredNamePair, } from '../linked-title-declared-name.ts';
import {
  exchangeFailureLogText,
  exchangeFailureText,
} from '../exchange-failure-text.ts';
import { repeatGroupsOf, } from '../repeat-groups.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { ArtifactConsolidateSlice, } from './artifact-two-lane-consolidate.ts';
import {
  type ArtifactConsistency,
  type ArtifactConsistencyGroup,
  type ConsistencyOccurrenceOutcome,
  NO_CONSISTENCY,
} from './artifact-two-lane-consistency.ts';
import type { ArtifactContestSlice, } from './artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './artifact-two-lane-derive.ts';
import { applyConsistency, } from './pass-consistency-apply.ts';
import {
  askAll,
  type PreparedGroup,
} from './pass-consistency-bench.ts';
import {
  dispositionOf,
  placesOf,
  repeatOf,
} from './pass-consistency-group.ts';
import {
  type ConsistencySliceFacts,
  consistencySlicesOf,
} from './pass-consistency-slices.ts';
import type { SettledGroup, } from './pass-consistency-types.ts';
import {
  settleUnasked,
  unplacedOf,
} from './pass-consistency-unasked.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import type { RunClient, } from './run-client-contract.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';

//region Pass consistency
// THE PAGE-LEVEL CONSISTENCY PASS (the owner's ruling of 2026-10-11). After the
// slices settle, repeated source wording and refrains that the page renders
// differently are put to the judge bench, one sheet per group; the bench picks
// the rendering or the pattern every place should follow and names the places
// whose context calls for their own; the chosen words are carried to the other
// places by code, and every changed slice passes every floor.
//
// A RUN ALWAYS SHIPS (the owner's rule). No trouble here stops an entry: a
// group that cannot be handled keeps its places as they stand and says so in
// its verdict, a pass that cannot run keeps the whole page as it stood and
// says so in the section's findings, and either is logged. An abort is the
// caller asking to stop, not trouble of this pass, and is passed on.

/**
 A group with its places and whether the bench is to be asked about it.

 @example
 ```ts
 const classified: ClassifiedGroup = { group, places, disposition: { kind: 'ask', }, };
 ```
 */
type ClassifiedGroup = PreparedGroup & {
  /**
   Whether the bench is asked, or why it is not.
   */
  readonly disposition: ReturnType<typeof dispositionOf>;
};

/**
 How many places of a group ended in an outcome.

 @param group - the group with its final outcomes

 @param outcome - outcome counted

 @returns Number of places with that outcome

 @example
 ```ts
 const replaced = placesEndingIn({ group, outcome: 'replaced', },);
 ```
 */
function placesEndingIn(
  {
    group,
    outcome,
  }: {
    readonly group: ArtifactConsistencyGroup;
    readonly outcome: ConsistencyOccurrenceOutcome;
  },
): number {
  return group.occurrences
    .filter(function ended(occurrence,): boolean {
      return occurrence.outcome === outcome;
    },)
    .length;
}

/**
 One line saying how a group came out.

 @param group - the group with its final outcomes

 @returns Log line text

 @example
 ```ts
 const line = groupLine({ group, },);
 ```
 */
function groupLine({ group, }: { readonly group: ArtifactConsistencyGroup; },): string {
  return `${group.repeat
    .kind} verdict=${group.verdict
      .kind} placed=${String(group.occurrences
        .length,)} `
    + `unplaced=${String(group.unplaced
      .length,)} `
    + `replaced=${String(placesEndingIn({
      group,
      outcome: 'replaced',
    },),)} `
    + `consistent=${String(placesEndingIn({
      group,
      outcome: 'consistent',
    },),)} `
    + `kept-context=${String(placesEndingIn({
      group,
      outcome: 'kept-context',
    },),)} `
    + `kept-floor=${String(placesEndingIn({
      group,
      outcome: 'kept-floor',
    },),)} `
    + `overlapped=${String(placesEndingIn({
      group,
      outcome: 'overlapped',
    },),)} `
    + `unlocated=${String(placesEndingIn({
      group,
      outcome: 'unlocated',
    },),)}`;
}

/**
 Settles every group: the bench is asked about those that need it, and the
 rest are left as they stand with the reason.

 @param client - provider client

 @param text - whole original

 @param classified - every group with its places and disposition, in page order

 @param identityContext - declared identity lines of the page, which each sheet shows

 @param referenceContext - lines of the pages the original cites, which each sheet shows

 @param lifeEnded - whether the entry records a death, which adds the tense block to each sheet

 @param subjectNames - names the translation declares for its subject

 @param declared - name pairs the front matter declares, which the floors read

 @param declaredNames - declared name forms, which the floors keep

 @param entryCacheDir - per-entry cache root

 @param pipelineDigest - generation stamp for the cache

 @param signal - entry cancellation

 @param overlap - most groups in flight

 @param l - logger the pass writes to

 @param stageSettings - straggler windows the entry file read for this launch

 @returns One settled group per group, in page order

 @throws The abort reason when the caller stopped the work, and whatever the
 seat reading and the cache opening throw, which the pass contains

 @example
 ```ts
 const settled = await settleAll({ client, text, classified, declared: [], declaredNames: [], entryCacheDir, pipelineDigest, signal, overlap, l, stageSettings, },);
 ```
 */
async function settleAll(
  {
    client,
    text,
    classified,
    identityContext,
    referenceContext,
    lifeEnded,
    subjectNames,
    declared,
    declaredNames,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    l,
    stageSettings,
  }: {
    readonly client: RunClient;
    readonly text: string;
    readonly classified: readonly ClassifiedGroup[];
    readonly identityContext?: string;
    readonly referenceContext?: string;
    readonly lifeEnded?: boolean;
    readonly subjectNames?: readonly string[];
    readonly declared: readonly DeclaredNamePair[];
    readonly declaredNames: readonly string[];
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly signal: AbortSignal;
    readonly overlap: number;
    readonly l: Logger;
    readonly stageSettings: StageSettings;
  },
): Promise<readonly SettledGroup[]> {
  /**
   Groups to put to the bench, in page order.
   */
  const toAsk = classified.filter(function asks(entry,): boolean {
    return entry.disposition
      .kind
      === 'ask';
  },);
  /**
   Groups settled by the bench, in the order of `toAsk`.
   */
  const asked = await askAll({
    client,
    text,
    toAsk,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    ...((referenceContext === undefined) ? {} : { referenceContext, }),
    ...((lifeEnded === undefined) ? {} : { lifeEnded, }),
    ...((subjectNames === undefined) ? {} : { subjectNames, }),
    declared,
    declaredNames,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    l,
    stageSettings,
  },);
  /**
   Position among the groups asked of the next one met.
   */
  const cursor = { next: 0, };
  return classified.map(function settle(entry,): SettledGroup {
    if (entry.disposition
      .kind
      === 'skip') {
      return settleUnasked({
        repeat: repeatOf({
          group: entry.group,
          text,
        },),
        places: entry.places,
        unplaced: unplacedOf({ group: entry.group, },),
        reason: entry.disposition
          .reason,
      },);
    }
    /**
     This group's settlement.
     */
    const settled = asked[cursor.next];
    cursor.next += 1;
    if (settled === undefined)
      throw new ConsistencyInvariantError({ invariant: 'a group put to the bench came back with no settlement', },);
    return settled;
  },);
}

/**
 Runs the page-level consistency pass for one entry.

 @param client - shared provider client

 @param prepared - the preparation both lanes ran over

 @param projected - both lanes' rows and the comparison

 @param contestSlices - what the lane contest decided

 @param consolidateSlices - what the third rendering settled

 @param archiveDisputes - slices whose archive rendering the repair lane disputed

 @param entryCacheDir - per-entry cache root

 @param pipelineDigest - generation stamp for the cache

 @param signal - entry cancellation

 @param overlap - most groups in flight

 @param l - entry logger

 @param stageSettings - straggler windows the entry file read for this launch

 @returns What the pass did, which changes nothing where it was stopped

 @throws The abort reason when the caller stopped the work

 @example
 ```ts
 const consistency = await runPassConsistency({ client, prepared, projected, contestSlices, consolidateSlices, archiveDisputes, entryCacheDir, pipelineDigest, signal, overlap, l, stageSettings, },);
 ```
 */
export async function runPassConsistency(
  {
    client,
    prepared,
    projected,
    contestSlices,
    consolidateSlices,
    archiveDisputes,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    l,
    stageSettings,
  }: {
    readonly client: RunClient;
    readonly prepared: PreparedDocumentPair;
    readonly projected: ProjectedLanes;
    readonly contestSlices: readonly ArtifactContestSlice[];
    readonly consolidateSlices: readonly ArtifactConsolidateSlice[];
    readonly archiveDisputes: ReadonlyMap<number, ArchiveDispute>;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly signal: AbortSignal;
    readonly overlap: number;
    readonly l: Logger;
    readonly stageSettings: StageSettings;
  },
): Promise<ArtifactConsistency> {
  /**
   Logger pre-tagged with this function's name.
   */
  const cl = tagged({
    tag: runPassConsistency.name,
    l,
  },);
  try {
    /**
     What the pass reads of each slice.
     */
    const slices: readonly ConsistencySliceFacts[] = consistencySlicesOf({
      prepared,
      projected,
      contestSlices,
      consolidateSlices,
      archiveDisputes,
    },);
    /**
     Whole original.
     */
    const text = prepared.sourceText;
    /**
     Every repeat of body wording, placed in the slices that hold it.
     */
    const groups = repeatGroupsOf({
      text,
      slices: prepared.slices
        .map(function sourceOf(slice,) {
          return slice.source;
        },),
    },);
    if (groups.length === 0) {
      cl.info('the page repeats no wording, so nobody is asked',);
      return NO_CONSISTENCY;
    }
    /**
     Every group settled, in page order.
     */
    const settled = await settleAll({
      client,
      text,
      classified: groups.map(function classify(group,): ClassifiedGroup {
        /**
         Places a slice holds whole.
         */
        const places = placesOf({
          group,
          slices,
        },);
        return {
          group,
          places,
          disposition: dispositionOf({ places, },),
        };
      },),
      ...((prepared.identityContext === undefined) ? {} : { identityContext: prepared.identityContext, }),
      ...((prepared.referenceContext === undefined) ? {} : { referenceContext: prepared.referenceContext, }),
      ...((prepared.lifeEnded === true) ? { lifeEnded: true, } : {}),
      ...((prepared.subjectNames === undefined) ? {} : { subjectNames: prepared.subjectNames, }),
      declared: prepared.declaredNamePairs ?? [],
      declaredNames: prepared.declaredNames,
      entryCacheDir,
      pipelineDigest,
      signal,
      overlap,
      l: cl,
      stageSettings,
    },);
    /**
     Replacements applied, floors run.
     */
    const applied = applyConsistency({
      settled,
      slices,
      declared: prepared.declaredNamePairs ?? [],
      declaredNames: prepared.declaredNames,
      l: cl,
    },);
    for (const [position, group,] of applied.groups
      .entries()) {
      cl.info(`group ${String(position + 1,)} of ${String(applied.groups
        .length,)}: ${groupLine({ group, },)}`,);
    }
    cl.info(
      `settled groups=${String(applied.groups
        .length,)} changed slices=${String(applied.slices
          .length,)}`,
    );
    return {
      groups: applied.groups,
      slices: applied.slices,
      findings: [
        ...settled.flatMap(function gatherFindings(
          group,
          position,
        ): readonly string[] {
          return group.findings
            .map(function underGroup(finding,): string {
              return `group ${String(position + 1,)}: ${finding}`;
            },);
        },),
        ...applied.findings,
      ],
    };
  }
  catch (error) {
    if (signal.aborted)
      throw error;
    cl.error(
      `the consistency pass stopped (${exchangeFailureLogText({ error, },)}); the page keeps the wording it had`,
    );
    return {
      ...NO_CONSISTENCY,
      findings: [
        `the consistency pass stopped (${exchangeFailureText({ error, },)}), so no slice was changed`,
      ],
    };
  }
}

//endregion Pass consistency
