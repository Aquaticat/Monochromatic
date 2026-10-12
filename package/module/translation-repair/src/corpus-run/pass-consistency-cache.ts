import { createHash, } from 'node:crypto';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { ConsistencyVoice, } from '../consistency-count-types.ts';
import { CONSISTENCY_CACHE_VERSION, } from '../consistency-cache-version.ts';
import { isConsistencyBallotWire, } from '../consistency-wire.ts';
import { hashContent, } from '../document-node.ts';
import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import type { SliceCache, } from '../slice-cache.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import {
  openNamespacedCache,
  PAGE_CONSISTENCY_NAMESPACE,
} from './slice-cache-namespace.ts';

//region Pass consistency cache
// THE BALLOTS OF ONE REPEATED WORDING, kept so a resumed page counts the same
// ballots and lands on the same page. What is stored is what the bench said,
// with the quorum the gather closed on; the counting against the English is
// not stored, since it is deterministic and moves with the English it reads.

/**
 What one settled gather stores.

 @example
 ```ts
 const record: ConsistencyRecord = { quorum: 2, voices: [], findings: [], };
 ```
 */
export type ConsistencyRecord = {
  /**
   Voices the gather closed on.
   */
  readonly quorum: number;

  /**
   Every ballot heard, with its seat.
   */
  readonly voices: readonly ConsistencyVoice[];

  /**
   What the gather reported: a short bench, a seat that stayed unheard.
   */
  readonly findings: readonly string[];
};

/**
 Whether a stored value is a gather's record.

 A STORED RECORD IS AN OUTSIDE READ, so it must be one the persistence rule
 writes: a gather is stored only once it reached its quorum, and a quorum is
 at least one (a negative one is refused by the artifact reader, which would
 leave the run's own artifact unreadable), so a record of a quorum below one,
 or of fewer voices than its quorum, is no gather's and is asked again. A
 quorum beyond what JSON carries exactly is refused by the voice count.

 @param value - parsed stored record

 @returns Whether it can be counted again

 @example
 ```ts
 isConsistencyRecord({ quorum: 2, voices: [], findings: [], },);
 ```
 */
function isConsistencyRecord(value: unknown,): value is ConsistencyRecord {
  return isJsonRecord(value,)
    && ((typeof value.quorum) === 'number')
    && Number.isInteger(value.quorum,)
    && (value.quorum >= 1)
    && isJsonArray(value.voices,)
    && (value.voices
      .length
      >= value.quorum)
    && value.voices
    .every(function isVoice(voice,): boolean {
        return isJsonRecord(voice,) && ((typeof voice.seat) === 'string')
          && isConsistencyBallotWire(voice,);
      },)
    && isJsonArray(value.findings,)
    && value.findings
    .every(function isFinding(finding,): boolean {
        return (typeof finding) === 'string';
      },);
}

/**
 Opens an entry's page consistency cache.

 @param dir - per-entry slice-cache directory

 @param generation - digest of the built pipeline this pass runs

 @returns Cache resuming settled gathers and persisting new ones

 @example
 ```ts
 const cache = await openConsistencyCache({ dir: entryCacheDir, generation, },);
 ```
 */
export async function openConsistencyCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<ConsistencyRecord>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: PAGE_CONSISTENCY_NAMESPACE,
    isValue: isConsistencyRecord,
  },);
}

/**
 Names one question: the version, the whole sheet the bench is shown (which
 holds the wording, every place's paragraph and English, the declared identity
 and the cited pages) and the bench that answers, as one JSON value so no two
 questions share a key.

 @param messages - the sheet

 @param modelIds - bench asked

 @returns Cache key

 @example
 ```ts
 const key = consistencyKey({ messages, modelIds, },);
 ```
 */
export function consistencyKey(
  {
    messages,
    modelIds,
  }: {
    readonly messages: readonly ChatMessage[];
    readonly modelIds: readonly RosterModelId[];
  },
): string {
  return createHash('sha256',)
    .update(
      JSON.stringify({
        version: CONSISTENCY_CACHE_VERSION,
        sheet: hashContent({ content: JSON.stringify(messages,), },),
        roster: modelIds,
      },),
      'utf8',
    )
    .digest('hex',);
}

//endregion Pass consistency cache
