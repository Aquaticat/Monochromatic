/**
 Guards ledger X19 at the preparation: every outside read goes through the
 readers its caller hands over, each asked once about the original, and what
 each returns reaches the sheets, so a test that hands over readers reading
 nothing buys no web search and reads no corpus.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type PassOutsideReads,
  type PipelineDigest,
  preparePassEntry,
  type RosterModelId,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 Logger the preparation writes to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-outside-reads-test', },);

/**
 Roster the preparation asks.
 */
const ROSTER: readonly RosterModelId[] = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
];

/**
 Cache generation the preparation's caches are stamped with.
 */
const DIGEST = 'pass-outside-reads-test' as PipelineDigest;

/**
 Original naming a cat another entry declares.
 */
const SOURCE = '猫糖在窗台上睡着了。';

/**
 Evidence line the work-title reader answers with.
 */
const WORK_TITLE_LINE = 'WORK TITLE EVIDENCE: 猫之歌 is published as "Song of the Cat"';

/**
 Client pairing the one block of each side, refusing every other sheet.

 @returns Client serving only structured calls

 @example
 ```ts
 const client = pairingClient();
 ```
 */
function pairingClient(): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Every pairing round's reply.
       */
      const value: unknown = { pairs: [{ source: 0, target: 0, },], };
      return request.validate(value,)
        ? { kind: 'ok', value, rawText: JSON.stringify(value,), }
        : { kind: 'schema-mismatch', rawText: '{}', detail: 'fixture answers pairing only', };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

await describe({
  name: 'preparePassEntry reads outside the pipeline only through its readers (ledger X19)',
  children: [
    it({
      name: 'ASKS EACH READER ONCE ABOUT THE ORIGINAL, and carries the work-title evidence and the other '
        + 'entry\'s name on the sheets',
      fn: async () => {
        /**
         Originals each reader that reads one was asked about.
         */
        const askedAbout: Record<'workTitles' | 'references', string[]> = {
          workTitles: [],
          references: [],
        };
        /**
         Reads the corpus-name reader took, which reads no original.
         */
        const corpusReads = { count: 0, };
        /**
         Readers recording what they were asked.
         */
        const outsideReads: PassOutsideReads = {
          workTitles: async ({ sourceText, },) => {
            askedAbout.workTitles.push(sourceText,);
            return [WORK_TITLE_LINE,];
          },
          references: async ({ sourceText, },) => {
            askedAbout.references.push(sourceText,);
            return '';
          },
          corpusNames: async () => {
            corpusReads.count += 1;
            return [{ source: '猫糖', renderings: ['Cat Candy',], entryId: 'gum', },];
          },
        };
        /**
         Directory this case owns for its entry caches.
         */
        const dir = await mkdtemp(join(tmpdir(), 'pass-outside-reads-',),);
        /**
         The preparation.
         */
        const paired = await preparePassEntry({
          client: pairingClient(),
          entryId: 'CatEntry',
          entryCacheDir: dir,
          pipelineDigest: DIGEST,
          modelIds: ROSTER,
          sourceText: SOURCE,
          targetText: 'Cat Candy fell asleep on the windowsill.',
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
          outsideReads,
        },);
        await rm(dir, { recursive: true, force: true, },);
        /**
         What every slice sheet reads about the page.
         */
        const identityContext = paired.prepared.identityContext ?? '';
        expect({
          askedAbout,
          corpusReads: corpusReads.count,
          workTitle: identityContext.includes(WORK_TITLE_LINE,),
          corpusName: identityContext.includes('- 猫糖 (entry gum): "Cat Candy"',),
        },).toEqual({
          askedAbout: {
            workTitles: [SOURCE,],
            references: [SOURCE,],
          },
          corpusReads: 1,
          workTitle: true,
          corpusName: true,
        },);
      },
    },),
  ],
},);
