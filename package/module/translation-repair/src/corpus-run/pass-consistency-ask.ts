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
  type ConsistencyBallotWire,
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
 One heard ballot as the pass keeps it: the seat the roster asked and the ballot's
 own fields, nothing else a reply carried.

 @param seat - roster seat that answered, which no reply field can replace

 @param ballot - the reply, of the right shape

 @returns The ballot with its seat

 @example
 ```ts
 const voice = voiceOf({ seat: 'glm-5.3', ballot, },);
 ```
 */
function voiceOf(
  {
    seat,
    ballot,
  }: {
    readonly seat: string;
    readonly ballot: ConsistencyBallotWire;
  },
): ConsistencyVoice {
  return {
    seat,
    reason: ballot.reason,
    quotes: ballot.quotes
      .map(function quoteOf(entry,): ConsistencyBallotWire['quotes'][number] {
        return {
          label: entry.label,
          quote: entry.quote,
          ...((entry.slot === undefined) ? {} : { slot: entry.slot, }),
        };
      },),
    choice: ballot.choice,
    keep: [...ballot.keep,],
  };
}

/**
 Whether the ballots of a stored gather are ones a fresh gather over this
 bench could have heard: each from a seat of the bench and each seat once,
 which also bounds them by the bench's size.

 THE QUORUM IS NOT THIS CHECK'S QUESTION. A stored record has already passed
 the cache's own check (`isConsistencyRecord` in `pass-consistency-cache.ts`:
 a quorum of one at least, and no fewer ballots than it), and no bound on the
 quorum can be sharper than that: a gather closes on one voice when the bench
 seats one or two, or when the run withheld all but one or two of its seats
 (the key names the whole bench, not the seats left), so a floor of two would
 ask again a gather this pass made and spent paid calls on.

 @param record - the stored gather

 @param modelIds - bench asked

 @returns Whether it can be counted again as the answer to this question

 @example
 ```ts
 const fits = recordFits({ record, modelIds, },);
 ```
 */
function recordFits(
  {
    record,
    modelIds,
  }: {
    readonly record: ConsistencyRecord;
    readonly modelIds: readonly RosterModelId[];
  },
): boolean {
  /**
   Seats heard.
   */
  const seats = record.voices
    .map(function seatOf(voice,): string {
    return voice.seat;
  },);
  return (new Set(seats,).size === seats.length)
    && seats.every(function isSeated(seat,): boolean {
      return modelIds.some(function isSeat(modelId,): boolean {
        return modelId === seat;
      },);
    },);
}

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
    ...((subject.lifeEnded === undefined) ? {} : { lifeEnded: subject.lifeEnded, }),
    ...((subject.subjectNames === undefined) ? {} : { subjectNames: subject.subjectNames, }),
  },);
  /**
   The answer an earlier run stored under this question's key.
   */
  const stored = cache.resumed
    .get(key,);
  /**
   The stored answer, when it is one this bench could have given.
   */
  const cached = ((stored !== undefined) && recordFits({
    record: stored,
    modelIds,
  },)) ? stored : undefined;
  if ((stored !== undefined) && (cached === undefined)) {
    al.warn(
      'the stored ballots cannot be an answer of this bench (a seat heard twice, or a seat the bench does not have), so the question is asked again',
    );
  }
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
      return voiceOf({
        seat: voice.modelId,
        ballot: voice.value,
      },);
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
