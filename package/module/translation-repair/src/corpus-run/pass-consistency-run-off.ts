import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import type { ConsistencyRendering, } from '../consistency-count-types.ts';
import {
  canonicalChoiceOf,
  type ConsistencyChoiceVoice,
  consistencyChoiceResponseFormat,
  usableChoiceFor,
} from '../consistency-choice.ts';
import { buildConsistencyRunOffMessages, } from '../consistency-run-off.ts';
import type { ConsistencySubject, } from '../consistency-sheet.ts';
import type { SliceCache, } from '../slice-cache.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import {
  type ConsistencyCacheValue,
  type ConsistencyChoiceRecord,
  consistencyKey,
} from './pass-consistency-cache.ts';
import { gatherThroughCache, } from './pass-consistency-gather.ts';

//region Pass consistency run-off
// ASKING THE BENCH ONCE MORE among the places that tied for first, or resuming
// what it said. The sheet shows only the finalists (`consistency-run-off.ts`);
// the gather, the cache and the quorum are the first round's, under a key that
// names the run-off, so a resumed page runs off the same tie the same way.

/**
 What the run-off produced: the choices, the quorum and what the gather
 reported.

 @example
 ```ts
 const asked: ConsistencyRunOffAsked = { kind: 'choice', quorum: 2, voices: [], findings: [], resumed: false, };
 ```
 */
export type ConsistencyRunOffAsked = ConsistencyChoiceRecord & {
  /**
   Whether the record was read back from an earlier run rather than bought.
   */
  readonly resumed: boolean;
};

/**
 Reads a stored value as a run-off's or a choice's record.

 @param value - what the cache holds under a key

 @returns The record as a list of one, none when the value is another kind

 @example
 ```ts
 const [record,] = storedChoices(value,);
 ```
 */
export function storedChoices(value: ConsistencyCacheValue,): readonly ConsistencyChoiceRecord[] {
  return (('kind' in value) && (value.kind === 'choice')) ? [value,] : [];
}

/**
 Builds the record of a gather of choices, voices in roster order.

 @param quorum - voices the gather closed on

 @param voices - the choices heard with their seats

 @param findings - what the gather reported

 @param labels - labels the sheet showed, which each choice is stored as the shown label it names (the lead's ruling of
 2026-10-15); each choice is stored as heard where absent

 @returns The record

 @example
 ```ts
 const record = choiceRecordOf({ quorum: 2, voices, findings: [], labels: ['OCCURRENCE 1', 'OCCURRENCE 2',], },);
 ```
 */
export function choiceRecordOf(
  {
    quorum,
    voices,
    findings,
    labels,
  }: {
    readonly quorum: number;
    readonly voices: readonly {
      readonly modelId: RosterModelId;
      readonly value: {
        readonly reason: string;
        readonly choice: string;
      };
    }[];
    readonly findings: readonly string[];
    readonly labels?: readonly string[];
  },
): ConsistencyChoiceRecord {
  return {
    kind: 'choice',
    quorum,
    voices: voices.map(function voiceOf({
      modelId,
      value,
    },): ConsistencyChoiceVoice {
      /**
       The choice with the shown label it names, as a list of zero or one; none where the labels are not given or the choice
       names none, which the gather's guard has already refused.
       */
      const [shown,] = (labels === undefined)
        ? []
        : canonicalChoiceOf({
          ballot: value,
          labels,
        },);
      return {
        seat: modelId,
        reason: value.reason,
        choice: shown?.choice ?? value.choice,
      };
    },),
    findings,
  };
}

/**
 Asks the bench to settle a tie for first, or reads its earlier answer.

 @param client - provider client

 @param modelIds - bench asked, in roster order

 @param subject - the repeated wording and every place it stands

 @param finalists - labels of the places that tied, the only places the sheet shows

 @param renderings - each place's rendering as the first round located it, in the order of the places

 @param cache - store an earlier answer is read from and a settled one kept in

 @param signal - entry deadline and caller abort

 @param exchangeTimeoutMs - per-call bound

 @param l - logger the stage writes to

 @param stageSettings - straggler windows the entry file read for this launch

 @returns The choices heard, the quorum the gather closed on and its findings

 @throws {@link import('../stage-roster-repeat.ts').StageRosterRepeatError} when the bench seats one model twice

 @example
 ```ts
 const asked = await askRunOff({ client, modelIds, subject, finalists, renderings, cache, signal, exchangeTimeoutMs, l, stageSettings, },);
 ```
 */
export async function askRunOff(
  {
    client,
    modelIds,
    subject,
    finalists,
    renderings,
    cache,
    signal,
    exchangeTimeoutMs,
    l,
    stageSettings,
  }: {
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly subject: ConsistencySubject;
    readonly finalists: readonly string[];
    readonly renderings: readonly ConsistencyRendering[];
    readonly cache: SliceCache<ConsistencyCacheValue>;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly stageSettings: StageSettings;
  },
): Promise<ConsistencyRunOffAsked> {
  /**
   The sheet every judge reads.
   */
  const messages = buildConsistencyRunOffMessages({
    subject,
    finalists,
    renderings,
  },);
  /**
   The run-off's record, and whether the cache supplied it.
   */
  const {
    record,
    resumed,
  } = await gatherThroughCache({
    client,
    modelIds,
    messages,
    signal,
    exchangeTimeoutMs,
    responseFormat: consistencyChoiceResponseFormat({ labels: finalists, },),
    validate: usableChoiceFor({ labels: finalists, },),
    stage: 'page-consistency-run-off',
    graceMs: stageSettings
      .grace
      .roundMs,
    cache,
    key: consistencyKey({
      stage: 'run-off',
      messages,
      modelIds,
      ...((subject.lifeEnded === undefined) ? {} : { lifeEnded: subject.lifeEnded, }),
      ...((subject.subjectNames === undefined) ? {} : { subjectNames: subject.subjectNames, }),
    },),
    readStored: storedChoices,
    recordOf: function recordFor(gathered,): ConsistencyChoiceRecord {
      return choiceRecordOf({
        ...gathered,
        labels: finalists,
      },);
    },
    l,
  },);
  return {
    ...record,
    resumed,
  };
}

//endregion Pass consistency run-off
