/**
 * Tests for how much of the ORIGINAL a fidelity judge is shown.
 *
 * Two things are pinned here, and they are the two halves of one claim. First,
 * that {@link neighbouringSource} takes one section each way and nothing more,
 * including at both ends of a document where there is no such section. Second,
 * that the trial's sheet carries the surrounding text ONLY when a caller
 * supplied it, which is what lets a narrow arm and a wide arm be compared as
 * differing in exactly one thing. That second claim was argued in a comment and
 * enforced nowhere, so the measured 12-of-16 against 15-of-16 rested on it
 * without evidence.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkPair,
  type FidelityOutcome,
  neighbouringSource,
  runFidelityTrial,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger the trial writes its progress to.
 */
const l = tagged({ tag: 'fidelity-window-test', },);

/**
 * Label the sheet gives the neighbouring sections.
 *
 * Matched on its distinctive opening rather than in full, so rewording the
 * explanatory tail does not fail a test that is about presence.
 */
const SURROUNDING_LABEL = 'SURROUNDING ORIGINAL';

/**
 * Roster the sheets go to.
 *
 * THREE RATHER THAN ONE because selection requires a minimum weight of two: a
 * lone judge backing a candidate at full weight still falls short, and the
 * trial declines. A one-model roster would make every sheet assertion here read
 * a declined run.
 */
const ROSTER = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-C',
].map(function toModelId(id,): SyntheticModelId {
  return id as unknown as SyntheticModelId;
},);

/**
 * Builds one slice pair carrying given original text.
 *
 * Offsets and nodes are named directly rather than parsed, which
 * {@link ContentChunk} documents as a legitimate value of the type: what this
 * function is under test for is which TEXTS come back, and from where.
 *
 * @param text - original-side text this slice covers
 *
 * @param chunkIndex - position of this slice in its document
 *
 * @returns Pair whose original side carries that text
 *
 * @example
 * ```ts
 * const pair = sliceOf({ text: '## 简介\n', chunkIndex: 0, },);
 * ```
 */
function sliceOf(
  {
    text,
    chunkIndex,
  }: {
    readonly text: string;
    readonly chunkIndex: number;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: text.length,
      text,
    },
    target: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '',
    },
  };
}

/**
 * Three-slice document, so a middle slice has a neighbour either way.
 */
const SLICES: readonly ChunkPair[] = [
  '小猫在窗台上睡觉。\n',
  '她看着外面的鸟。\n',
  '傍晚她回到炉火旁。\n',
].map(function toSlice(
  text,
  chunkIndex,
) {
  return sliceOf({
    text,
    chunkIndex,
  },);
},);

await describe({
  name: neighbouringSource.name,
  children: [
    it({
      name: 'joins ONE section each way for a slice in the middle, which is the window `#107` '
        + 'says would fix a passage carried across a single boundary',
      fn: async () => {
        expect(neighbouringSource({
          slices: SLICES,
          sliceIndex: 1,
        },),).toBe('小猫在窗台上睡觉。\n\n\n傍晚她回到炉火旁。\n',);
      },
    },),
    it({
      name: 'gives the FIRST slice only its follower, since asking for index minus one at the '
        + 'start of a document must not read the end of the array',
      fn: async () => {
        expect(neighbouringSource({
          slices: SLICES,
          sliceIndex: 0,
        },),).toBe('她看着外面的鸟。\n',);
      },
    },),
    it({
      name: 'gives the LAST slice only its predecessor, and reaches ONE section back rather than '
        + 'to the start of the document',
      fn: async () => {
        expect(neighbouringSource({
          slices: SLICES,
          sliceIndex: 2,
        },),).toBe('她看着外面的鸟。\n',);
      },
    },),
    it({
      name: 'answers EMPTY for a lone slice, which is the value the trial reads as "render the '
        + 'narrow sheet" rather than an empty context block',
      fn: async () => {
        expect(neighbouringSource({
          slices: [sliceOf({
            text: '小猫在窗台上睡觉。\n',
            chunkIndex: 0,
          },),],
          sliceIndex: 0,
        },),).toBe('',);
      },
    },),
    it({
      name: 'THROWS on an index past the end rather than answering empty, because empty is what a '
        + 'lone slice answers: a wide arm handed a stray index would send the narrow sheet, and '
        + 'the comparison would report the window as making no difference',
      fn: async () => {
        expect(function askPastEnd() {
          return neighbouringSource({
            slices: SLICES,
            sliceIndex: SLICES.length,
          },);
        },).toThrow(RangeError,);
      },
    },),
    it({
      name: 'THROWS on a STAMPED chunk index that is not this array position, which is the live '
        + 'mistake `#99` recorded: the same number names three different things, and two of them '
        + 'silently read the wrong neighbours or none',
      fn: async () => {
        /**
         * Two slices of one section, stamped with the document-wide indices they
         * would carry in an entry whose earlier sections were not sliced.
         *
         * Passing `chunkIndex` here rather than the array position is the whole
         * hazard: `11` and `12` are ordinary stamps, and both are outside a
         * two-element array.
         */
        const stamped: readonly ChunkPair[] = [
          sliceOf({
            text: '小猫在窗台上睡觉。\n',
            chunkIndex: 11,
          },),
          sliceOf({
            text: '她看着外面的鸟。\n',
            chunkIndex: 12,
          },),
        ];
        expect(function askByStamp() {
          return neighbouringSource({
            slices: stamped,
            sliceIndex: stamped[0]?.source
              .chunkIndex ?? 0,
          },);
        },).toThrow('not a position in this entry',);
      },
    },),
    it({
      name: 'THROWS on a negative index rather than reading the end of the array, since a caller '
        + 'that already subtracted one would otherwise be handed the LAST slice as a neighbour of '
        + 'the first',
      fn: async () => {
        expect(function askBeforeStart() {
          return neighbouringSource({
            slices: SLICES,
            sliceIndex: -1,
          },);
        },).toThrow(RangeError,);
      },
    },),
  ],
},);

/**
 * Every sheet a run sent, in call order.
 */
type SentSheets = {
  /**
   * Sheets captured so far.
   */
  readonly sheets: string[];

  /**
   * Client that records them and votes for the first candidate.
   */
  readonly client: SyntheticClient;
};

/**
 * Builds a client that records each sheet and always backs candidate one.
 *
 * WHAT IT DOES NOT DO is judge. The vote is fixed because this test is about
 * what the judges are SHOWN; `judge-fidelity.unit.test.ts` covers what the
 * trial makes of what they say.
 *
 * @returns Recorder and the client writing into it
 *
 * @example
 * ```ts
 * const recorder = recordingClient();
 * ```
 */
function recordingClient(): SentSheets {
  /**
   * Sheets this client was sent.
   */
  const sheets: string[] = [];
  return {
    sheets,
    client: {
      chatText: async () => {
        throw new Error('chatText unused by selection',);
      },
      quotas: async () => {
        throw new Error('quotas unused by selection',);
      },
      chatJson: async <ValueT,>(
        request: ChatJsonRequest<ValueT>,
      ): Promise<ChatJsonOutcome<ValueT>> => {
        sheets.push(request.messages
          .map(function toContent(message,) {
            return message.content;
          },)
          .join('\n',),);

        /**
         * Wire value backing the first candidate.
         */
        const value: unknown = {
          best: 1,
          reason: 'fixture',
        };
        if (!request.validate(value,)) {
          return {
            kind: 'schema-mismatch',
            rawText: JSON.stringify(value,),
            detail: 'reply failed the wire guard',
          };
        }
        return {
          kind: 'ok',
          value: value as ValueT,
          rawText: JSON.stringify(value,),
        };
      },
    },
  };
}

/**
 * Runs one trial and answers every sheet it sent, with what the trial made of
 * the replies.
 *
 * The verdict comes back so a test can show the sheets were captured from a
 * COMPLETED trial: a run that failed every call would also record sheets, and
 * an assertion that some label is absent would pass on the wreckage.
 *
 * @param contextText - surrounding original, empty for a narrow run
 *
 * @returns Sheets the judges were sent, and the trial's verdict
 *
 * @example
 * ```ts
 * const run = await sheetsFor({ contextText: '', },);
 * ```
 */
async function sheetsFor(
  { contextText, }: { readonly contextText: string; },
): Promise<{
  readonly sheets: readonly string[];
  readonly verdict: FidelityOutcome['verdict'];
}> {
  /**
   * Recorder capturing this run.
   */
  const recorder = recordingClient();

  /**
   * What the trial made of a roster backing the first candidate.
   */
  const outcome = await runFidelityTrial({
    client: recorder.client,
    trial: {
      trialId: 'cat/1',
      direction: 'preserve',
      damageKind: 'alteration',
      sourceText: '小猫在二零二三年五月搬到窗台上。\n',
      contextText,
      cleanText: 'The cat moved to the windowsill in May 2023.\n',
      damagedText: 'The cat moved to the windowsill in May 2024.\n',
      cleanFirst: true,
    },
    judgeModelIds: ROSTER,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);
  return {
    sheets: recorder.sheets,
    verdict: outcome.verdict,
  };
}

await describe({
  name: `${runFidelityTrial.name} evidence`,
  children: [
    it({
      name: 'POSITIVE CONTROL: the narrow run reaches a verdict, so the sheets the other cases '
        + 'read were captured from a trial that completed rather than one that failed every call',
      fn: async () => {
        const run = await sheetsFor({ contextText: '', },);
        expect(run.verdict,).toBe('clean',);
        expect(run.sheets
          .length,).toBe(ROSTER.length,);
      },
    },),
    it({
      name: 'renders NO surrounding block on a narrow run, in EVERY judge sheet, so the arm '
        + 'measured before the window was widened is the sheet that was always sent',
      fn: async () => {
        const run = await sheetsFor({ contextText: '', },);
        expect(run.sheets
          .filter(function carriesLabel(sheet,) {
            return sheet.includes(SURROUNDING_LABEL,);
          },)
          .length,).toBe(0,);
      },
    },),
    it({
      name: 'renders the surrounding block AND its context-only caveat when a caller supplies '
        + 'one, which is the single difference between the narrow and wide arms',
      fn: async () => {
        const run = await sheetsFor({ contextText: '她看着外面的鸟。\n', },);
        expect(run.verdict,).toBe('clean',);
        expect(run.sheets
          .filter(function carriesContext(sheet,) {
            if (!sheet.includes(SURROUNDING_LABEL,))
              return false;
            if (!sheet.includes('她看着外面的鸟。',))
              return false;
            return sheet.includes('not expected to render this',);
          },)
          .length,).toBe(ROSTER.length,);
      },
    },),
    it({
      name: 'carries the slice ORIGINAL either way, since widening ADDS evidence rather than '
        + 'replacing what the judges were already reading',
      fn: async () => {
        /**
         * Both arms, run together because neither reads the other.
         */
        const runs = await Promise.all([
          '',
          '她看着外面的鸟。\n',
        ].map(async function toRun(contextText,) {
          return await sheetsFor({ contextText, },);
        },),);
        for (const run of runs) {
          expect(run.sheets
            .filter(function carriesOriginal(sheet,) {
              return sheet.includes('小猫在二零二三年五月搬到窗台上。',);
            },)
            .length,).toBe(ROSTER.length,);
        }
      },
    },),
  ],
},);
