import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { wordForCount, } from '../count-word.ts';
import { exchangeFailureLogText, } from '../exchange-failure-text.ts';
import type { ConsistencyVoice, } from '../consistency-count-types.ts';
import {
  buildConsistencyMessages,
  type ConsistencySubject,
} from '../consistency-sheet.ts';
import {
  CONSISTENCY_RESPONSE_FORMAT,
  consistencyLabels,
  usableConsistencyBallotFor,
} from '../consistency-wire.ts';
import type { SliceCache, } from '../slice-cache.ts';
import { gatherStageVoices, } from '../stage-quorum.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import {
  consistencyKey,
  type ConsistencyRecord,
} from './pass-consistency-cache.ts';

//region Pass consistency ask
// ASKING THE BENCH ONCE ABOUT ONE REPEATED WORDING, or resuming what it said.
// The quorum helper is `gatherStageVoices`, the one the page title stage asks
// through; its seats, quorum and retry rounds are the ones every judging stage
// has. A gather that reached its quorum is stored; one that did not is asked
// again on a resume, since a short bench may come back.

/**
 What asking produced: the ballots, the quorum and what the gather reported.

 @example
 ```ts
 const asked: ConsistencyAsked = { quorum: 2, voices: [], findings: [], resumed: false, };
 ```
 */
export type ConsistencyAsked = ConsistencyRecord & {
  /**
   Whether the record was read back from an earlier run rather than bought.
   */
  readonly resumed: boolean;
};

/**
 Asks the bench about one repeated wording, or reads its earlier answer.

 @param client - provider client

 @param modelIds - bench asked, in roster order

 @param subject - the repeated wording and every place it stands

 @param cache - store an earlier answer is read from and a settled one kept in

 @param signal - entry deadline and caller abort

 @param exchangeTimeoutMs - per-call bound

 @param l - logger the stage writes to

 @param stageSettings - straggler windows the entry file read for this launch

 @returns The ballots heard, the quorum the gather closed on and its findings

 @throws {@link StageRosterRepeatError} when the bench seats one model twice

 @example
 ```ts
 const asked = await askConsistencyBench({ client, modelIds, subject, cache, signal, exchangeTimeoutMs, l, stageSettings, },);
 ```
 */
export async function askConsistencyBench(
  {
    client,
    modelIds,
    subject,
    cache,
    signal,
    exchangeTimeoutMs,
    l,
    stageSettings,
  }: {
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly subject: ConsistencySubject;
    readonly cache: SliceCache<ConsistencyRecord>;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly stageSettings: StageSettings;
  },
): Promise<ConsistencyAsked> {
  /**
   Logger pre-tagged with this function's name.
   */
  const al = tagged({
    tag: askConsistencyBench.name,
    l,
  },);
  /**
   The sheet every judge reads.
   */
  const messages = buildConsistencyMessages({ subject, },);
  /**
   This question's identity.
   */
  const key = consistencyKey({
    messages,
    modelIds,
  },);
  /**
   The answer an earlier run settled for this question.
   */
  const cached = cache.resumed
    .get(key,);
  if (cached !== undefined) {
    al.info(
      `resumed ${String(cached.voices
        .length,)} ${
        wordForCount({
          count: cached.voices
            .length,
          one: 'ballot',
          many: 'ballots',
        },)
      }`,
    );
    return {
      ...cached,
      resumed: true,
    };
  }
  /**
   Quorum-bounded replies; a reply that cannot be counted against the places the
   sheet showed is asked again like one that is not a ballot.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds,
    messages,
    signal,
    exchangeTimeoutMs,
    responseFormat: CONSISTENCY_RESPONSE_FORMAT,
    validate: usableConsistencyBallotFor({ labels: consistencyLabels({ count: subject.occurrences
      .length, },), },),
    stage: 'page-consistency',
    l: al,
    graceMs: stageSettings
      .grace
      .roundMs,
  },);
  /**
   Voices in roster order, so a stored record does not depend on arrival.
   */
  const voices = gather.voices
    .toSorted(function byRoster(
      left,
      right,
    ): number {
      return modelIds.indexOf(left.modelId,) - modelIds.indexOf(right.modelId,);
    },)
    .map(function toVoice(voice,): ConsistencyVoice {
      return {
        seat: voice.modelId,
        ...voice.value,
      };
    },);
  /**
   What this gather comes to, stored whole.
   */
  const record: ConsistencyRecord = {
    quorum: gather.quorum,
    voices,
    findings: gather.findings,
  };
  // A GATHER THAT MISSED ITS QUORUM IS NOT AN ANSWER and is not stored: the
  // bench was short, not undecided, and storing that would keep the page
  // unsettled on every resume.
  if (gather.quorumMet) {
    try {
      await cache.persist({
        key,
        serialized: JSON.stringify(record,),
      },);
    }
    catch (error) {
      // A STORE THAT REFUSES COSTS THE RESUME, NOT THE PAGE: the ballots in
      // hand are counted either way.
      al.warn(`the ballots could not be stored (${exchangeFailureLogText({ error, },)}); they are counted all the same`,);
    }
  }
  return {
    ...record,
    resumed: false,
  };
}

//endregion Pass consistency ask
