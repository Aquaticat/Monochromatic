/**
 Tests which straggler window each round of the archive block review waits
 under (ledger B713): the review round asks for whole corrected blocks, so its
 replies are writer voices and it waits the writers' window, while the
 selection round after it is a reading of text that exists and keeps the
 readers' window.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { StageSettings, } from '@monochromatic-dev/translation-repair-stage';
import { runArchiveBlockReviewStage, } from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';
import { HANG_STOP_MS, } from '@monochromatic-dev/translation-repair-test-fixture/ts/hang-stop.test-fixture.ts';
import { scriptedClient, } from './scripted-review-client.test-fixture.ts';

/** Four seats, the last of which a case holds back as the straggler. */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
] as const;

/** The seat a case holds back. */
const STRAGGLER = SEAT_SYNTHETIC_TEXT_EVERYWHERE;

/**
 Windows that differ: the writers wait as long as a hang stop, every other
 round does not wait at all, so a round that reads the wrong one hears the
 straggler or cuts it by that alone.
 */
const WRITERS_WAIT_READERS_DO_NOT: StageSettings = {
  grace: {
    writerMs: HANG_STOP_MS,
    roundMs: 0,
    source: 'built-in',
  },
  contestLedger: { kind: 'unkept', },
};

/** Block under review. */
const BLOCK = 'The cat sleeps by the window and won an award.';

/** Revision every prompt seat writes. */
const QUICK_REVISION = 'The cat sleeps by the window.';

/** Revision only the straggler writes. */
const LATE_REVISION = 'The cat sleeps by the window and purrs.';

/** Logger for the window cases. */
const l = tagged({ tag: 'archive-block-review-windows-test', },);

/**
 Runs the stage over the one block with the windows given.

 @param heldSchema - schema whose reply the straggler holds back

 @param prompts - prompt capture sink

 @returns Stage outcome
 */
async function reviewWith(
  {
    heldSchema,
    prompts,
  }: {
    readonly heldSchema: string;
    readonly prompts: string[];
  },
): ReturnType<typeof runArchiveBlockReviewStage> {
  return await runArchiveBlockReviewStage({
    client: scriptedClient({
      prompts,
      heldFor: ({ modelId, schema, },) => (modelId === STRAGGLER) && (schema === heldSchema),
      replyFor: ({ schema, modelId, },) => schema === 'archive_block_review'
        ? {
          disposition: 'revise',
          sourceQuote: '',
          replacementText: modelId === STRAGGLER ? LATE_REVISION : QUICK_REVISION,
          finding: 'Remove the unsupported award claim.',
        }
        : {
          best: 1,
          reason: 'Only supported details remain.',
        },
    },),
    modelIds: ROSTER,
    sourceText: '猫在窗边睡觉。',
    targetText: BLOCK,
    blockText: BLOCK,
    blockOffset: 0,
    priorFindings: [],
    signal: new AbortController().signal,
    exchangeTimeoutMs: HANG_STOP_MS,
    l,
    fanOut: 'whole-bench',
    stageSettings: WRITERS_WAIT_READERS_DO_NOT,
  },);
}

await describe({
  name: 'archive block review windows',
  children: [
    it({
      name: 'WAITS THE WRITERS\' WINDOW IN THE REVIEW ROUND (ledger B713): a reviewer\'s revision is a whole '
        + 'candidate, so the straggler that answers after quorum is heard, loses no voice and reaches the slate',
      fn: async () => {
        /** Prompts, captured to read the slate the judges were shown. */
        const prompts: string[] = [];
        /** Review over a straggler in the review round. */
        const outcome = await reviewWith({
          heldSchema: 'archive_block_review',
          prompts,
        },);
        expect(outcome.findings.filter(function lostInReview(finding,): boolean {
          return finding.startsWith('stage-voice-lost (archive-block-review',);
        },),).toEqual([],);
        expect(prompts.some(function slateHoldsLateRevision(prompt,): boolean {
          return prompt.includes('CURRENT ARCHIVE BLOCK',) && prompt.includes(LATE_REVISION,);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'KEEPS THE READERS\' WINDOW IN THE SELECTION ROUND (ledger B713): a judge reading text that exists is '
        + 'one ballot in several, so the straggler that answers after quorum is cut and said lost',
      fn: async () => {
        /** Review over a straggler in the selection round. */
        const outcome = await reviewWith({
          heldSchema: 'candidate_ballot',
          prompts: [],
        },);
        expect(outcome.findings,).toContain(`stage-voice-lost (select ${STRAGGLER})`,);
      },
    },),
  ],
},);
