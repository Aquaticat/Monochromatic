import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import {
  exchangeFailureLogText,
  exchangeFailureText,
} from '../exchange-failure-text.ts';
import type { DeclaredNamePair, } from '../linked-title-declared-name.ts';
import { mapOverlapped, } from '../overlapped-map.ts';
import type { SliceCache, } from '../slice-cache.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { askConsistencyBench, } from './pass-consistency-ask.ts';
import {
  type ConsistencyCacheValue,
  openConsistencyCache,
} from './pass-consistency-cache.ts';
import { carryAll, } from './pass-consistency-carry.ts';
import { keptWordsOf, } from './pass-consistency-carry-units.ts';
import {
  type ConsistencyPlace,
  occurrenceViewOf,
  repeatOf,
} from './pass-consistency-group.ts';
import { askRunOff, } from './pass-consistency-run-off.ts';
import {
  countAsked,
  runOffReasonOf,
  settleAsked,
  settleCarried,
} from './pass-consistency-settle.ts';
import type {
  CarryWriters,
  SettledGroup,
} from './pass-consistency-types.ts';
import {
  settleFailed,
  unplacedOf,
} from './pass-consistency-unasked.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import type { RunClient, } from './run-client-contract.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';
import { readPhaseSeats, } from './run-seats-read.ts';
import type { RepeatGroup, } from '../repeat-groups-types.ts';

//region Pass consistency bench
// ASKING THE JUDGE BENCH ABOUT EVERY GROUP THAT NEEDS IT, side by side, and
// settling what it says: the first round's ballots, a run-off among the places
// that tied for first, and the carry of the chosen rendering to each receiving
// place by the writer bench and a choice among candidates. The seats are read
// when the first group needs them and not before, so a page that repeats nothing
// the bench must judge reads no meter and waits out no hold.

/**
 A group with the places a slice holds whole.

 @example
 ```ts
 const prepared: PreparedGroup = { group, places, };
 ```
 */
export type PreparedGroup = {
  /**
   The group the detector found.
   */
  readonly group: RepeatGroup;

  /**
   The places a slice holds whole.
   */
  readonly places: readonly ConsistencyPlace[];
};

/**
 Asks the bench about one group and settles it, containing whatever goes wrong.

 @param client - provider client

 @param modelIds - judge bench asked

 @param writers - whether the translate stage's writer bench carries the chosen rendering, and which seats

 @param text - whole original

 @param prepared - the group and its places

 @param cache - store an earlier answer is read from

 @param identityContext - declared identity lines of the page, which the sheet shows

 @param referenceContext - lines of the pages the original cites, which the sheet shows

 @param lifeEnded - whether the entry records a death, which adds the tense block to the sheet

 @param subjectNames - names the translation declares for its subject

 @param declared - name pairs the front matter declares, which the floors read

 @param declaredNames - declared name forms, which the floors keep

 @param signal - entry deadline and caller abort

 @param l - logger the pass writes to

 @param stageSettings - straggler windows the entry file read for this launch

 @returns The group settled, or left as it stands with its failure said

 @throws The abort reason when the caller stopped the work

 @example
 ```ts
 const settled = await settleAskedGroup({ client, modelIds, writers, text, prepared, cache, declared: [], declaredNames: [], signal, l, stageSettings, },);
 ```
 */
async function settleAskedGroup(
  {
    client,
    modelIds,
    writers,
    text,
    prepared,
    cache,
    identityContext,
    referenceContext,
    lifeEnded,
    subjectNames,
    declared,
    declaredNames,
    signal,
    l,
    stageSettings,
  }: {
    readonly client: RunClient;
    readonly modelIds: readonly RosterModelId[];
    readonly writers: CarryWriters;
    readonly text: string;
    readonly prepared: PreparedGroup;
    readonly cache: SliceCache<ConsistencyCacheValue>;
    readonly identityContext?: string;
    readonly referenceContext?: string;
    readonly lifeEnded?: boolean;
    readonly subjectNames?: readonly string[];
    readonly declared: readonly DeclaredNamePair[];
    readonly declaredNames: readonly string[];
    readonly signal: AbortSignal;
    readonly l: Logger;
    readonly stageSettings: StageSettings;
  },
): Promise<SettledGroup> {
  /**
   Logger pre-tagged with this function's name.
   */
  const gl = tagged({
    tag: settleAskedGroup.name,
    l,
  },);
  /**
   The repeated wording or frame.
   */
  const repeat = repeatOf({
    group: prepared.group,
    text,
  },);
  /**
   The places no slice holds whole.
   */
  const unplaced = unplacedOf({ group: prepared.group, },);
  try {
    /**
     The sheet the first round and the run-off show.
     */
    const subject = {
      repeat,
      occurrences: prepared.places
        .map(function viewOf(place,) {
          return occurrenceViewOf({
            place,
            text,
          },);
        },),
      ...((identityContext === undefined) ? {} : { identityContext, }),
      ...((referenceContext === undefined) ? {} : { referenceContext, }),
      ...((lifeEnded === undefined) ? {} : { lifeEnded, }),
      ...((subjectNames === undefined) ? {} : { subjectNames, }),
    };
    /**
     The first round's ballots.
     */
    const asked = await askConsistencyBench({
      client,
      modelIds,
      subject,
      cache,
      signal,
      exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: gl,
      stageSettings,
    },);
    /**
     What they come to, and the places that tied for first when they tie.
     */
    const count = countAsked({
      repeat,
      places: prepared.places,
      asked,
    },);
    if (count.finalists
      .length
      > 0) {
      gl.info(`asking the bench once more: ${runOffReasonOf({
        count,
        asked,
      },)}`,);
    }
    /**
     The bench asked once more among the places that tied for first, absent when none tied.
     */
    const runOff = (count.finalists
      .length
      === 0)
      ? undefined
      : await askRunOff({
        client,
        modelIds,
        subject,
        finalists: count.finalists,
        renderings: count.renderings,
        cache,
        signal,
        exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        l: gl,
        stageSettings,
      },);
    /**
     The group decided, with the places the chosen rendering is still to reach.
     */
    const decided = settleAsked({
      repeat,
      places: prepared.places,
      unplaced,
      asked,
      ...((runOff === undefined) ? {} : { runOff, }),
    },);
    /**
     The chosen place, none when no place won.
     */
    const [chosen,] = decided.chosen;
    return settleCarried({
      decided,
      carried: (chosen === undefined)
        ? []
        : await carryAll({
          context: {
            client,
            writers,
            judgeModelIds: modelIds,
            cache,
            text,
            ...((identityContext === undefined) ? {} : { identityContext, }),
            ...((referenceContext === undefined) ? {} : { referenceContext, }),
            ...((lifeEnded === undefined) ? {} : { lifeEnded, }),
            ...((subjectNames === undefined) ? {} : { subjectNames, }),
            declared,
            declaredNames,
            signal,
            l: gl,
            stageSettings,
          },
          repeat,
          chosen,
          receivers: decided.receivers,
          kept: keptWordsOf({ decided, },),
        },),
    },);
  }
  catch (error) {
    if (signal.aborted)
      throw error;
    gl.error(`the bench could not be asked or counted (${exchangeFailureLogText({ error, },)}); the places stay as they stand`,);
    return settleFailed({
      repeat,
      places: prepared.places,
      unplaced,
      detail: exchangeFailureText({ error, },),
    },);
  }
}

/**
 Names a group asked, for the line that reports a failure left unthrown.

 @param position - position of the group among those asked

 @returns Name of the group

 @example
 ```ts
 const name = groupAskedName({ item, position: 0, },); // 'group 1 asked'
 ```
 */
function groupAskedName(
  {
    position,
  }: {
    readonly item: PreparedGroup;
    readonly position: number;
  },
): string {
  return `group ${String(position + 1,)} asked`;
}

/**
 Whether the translate stage's writer bench carries the chosen rendering, and
 which seats, or why the writers are not asked.

 @param translators - the writer bench as the seat reading left it

 @param unreachableWriters - clauses naming each writing bench below its floor that no provider has named the return of

 @returns The writers to ask, or why they are not asked

 @example
 ```ts
 const writers = writersOf({ translators, unreachableWriters: [], },);
 ```
 */
export function writersOf(
  {
    translators,
    unreachableWriters,
  }: {
    readonly translators: readonly RosterModelId[];
    readonly unreachableWriters: readonly string[];
  },
): CarryWriters {
  if (unreachableWriters.length > 0) {
    return {
      kind: 'not-asked',
      why: `${unreachableWriters.join('; ',)}; no provider has named its return`,
    };
  }
  if (translators.length === 0) {
    return {
      kind: 'not-asked',
      why: 'the translators bench seats no model',
    };
  }
  return {
    kind: 'asked',
    modelIds: translators,
  };
}

/**
 Puts every group the bench is asked about to the bench, side by side.

 @param client - provider client

 @param text - whole original

 @param toAsk - groups to put to the bench, in page order

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

 @returns One settled group per group asked, in page order

 @throws The abort reason when the caller stopped the work, and whatever the
 seat reading and the cache opening throw, which the pass contains

 @example
 ```ts
 const settled = await askAll({ client, text, toAsk, declared: [], declaredNames: [], entryCacheDir, pipelineDigest, signal, overlap, l, stageSettings, },);
 ```
 */
export async function askAll(
  {
    client,
    text,
    toAsk,
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
    readonly toAsk: readonly PreparedGroup[];
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
  if (toAsk.length === 0)
    return [];
  /**
   This phase's benches, read now and only when someone is to be asked, and the
   writing benches below their floor that the phase goes on without.
   */
  const {
    seats,
    unreachableWriters,
  } = await readPhaseSeats({
    client,
    phase: 'page consistency',
    signal,
    l,
  },);
  /**
   Whether the writers are asked, and which seats.
   */
  const writers = writersOf({
    translators: seats.translators,
    unreachableWriters,
  },);
  /**
   Store earlier answers are read from.
   */
  const cache = await openConsistencyCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  return await mapOverlapped({
    items: toAsk,
    overlap,
    oneItem: async function askOne({ item, },): Promise<SettledGroup> {
      return await settleAskedGroup({
        client,
        modelIds: seats.lateJudges,
        writers,
        text,
        prepared: item,
        cache,
        ...((identityContext === undefined) ? {} : { identityContext, }),
        ...((referenceContext === undefined) ? {} : { referenceContext, }),
        ...((lifeEnded === undefined) ? {} : { lifeEnded, }),
        ...((subjectNames === undefined) ? {} : { subjectNames, }),
        declared,
        declaredNames,
        signal,
        l,
        stageSettings,
      },);
    },
    signal,
    l,
    nameOf: groupAskedName,
  },);
}

//endregion Pass consistency bench
