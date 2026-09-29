/**
 Guards class forty-three (2026-09-17): a detail one voice extracted and both
 quotes verified is put to the bench again as a yes-or-no candidate, and the
 voices that answered the open question with an empty list get to confirm it.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  attestCitedReferences,
  buildReferenceAttestConfirmMessages,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  confirmedDetails,
  isReferenceAttestConfirmWire,
  messageText,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 Test logger.
 */
const l = tagged({ tag: 'reference-attest-confirm', },);

/**
 Four seats.
 */
const ROSTER: readonly RosterModelId[] = [
  'minimax-m3',
  'deepseek-v4.1-flash',
  'gemma-4-26b-a4b-it',
  'google.gemma-4-e2b',
] as RosterModelId[];

/**
 Original naming a younger brother and nothing more about him.
 */
const SOURCE_TEXT = '猫有一个弟弟。';

/**
 Archive carrying the detail the reference states.
 */
const ARCHIVE_TEXT = 'The cat has a younger brother who also dozes on the windowsill.';

/**
 One reference stating it, as `citedReferenceBlock` renders it.
 */
const REFERENCE_CONTEXT = '- reference 1 https://example.invalid/cat-notes: Mittens had a younger brother who also dozed on the windowsill.';

/**
 The item one voice extracts.
 */
const BROTHER_ITEM = {
  archiveQuote: 'a younger brother who also dozes on the windowsill',
  reference: 1,
  referenceQuote: 'a younger brother who also dozed on the windowsill',
};

/**
 Client answering the open question from one table and the yes-or-no
 question from another, told apart by the CANDIDATE label on the sheet.

 @param extraction - reply per seat to the open question

 @param confirmation - reply per seat to the yes-or-no question

 @param prompts - sink for every sheet seen

 @returns Client

 @example
 ```ts
 const client = twoRoundClient({ extraction: {}, confirmation: {}, prompts: [], },);
 ```
 */
function twoRoundClient(
  {
    extraction,
    confirmation,
    prompts,
  }: {
    readonly extraction: Readonly<Record<string, unknown>>;
    readonly confirmation: Readonly<Record<string, unknown>>;
    readonly prompts: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Every message of this sheet as one string.
       */
      const sheet = request.messages
        .map(function toText(message,) {
          return messageText({ message, },);
        },)
        .join('\n',);
      prompts.push(sheet,);
      /**
       Whether this is the yes-or-no round.
       */
      const confirming = sheet.includes('CANDIDATE',);
      /**
       Scripted reply for this seat and round.
       */
      const value = confirming
        ? (confirmation[request.modelId] ?? { confirmed: [], })
        : (extraction[request.modelId] ?? { attested: [], });
      if (!request.validate(value,))
        throw new Error('scripted reply failed validator',);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

await describe({
  name: 'reference attestation confirmation (class forty-three)',
  children: [
    it({
      name: 'KEEPS a detail one voice extracted when the bench confirms it, where the extraction quorum alone would have dropped it',
      fn: async () => {
        const prompts: string[] = [];
        const attestation = await attestCitedReferences({
          client: twoRoundClient({
            prompts,
            extraction: { [ROSTER[2] ?? '']: { attested: [BROTHER_ITEM,], }, },
            confirmation: {
              [ROSTER[0] ?? '']: { confirmed: [1,], },
              [ROSTER[1] ?? '']: { confirmed: [1,], },
              [ROSTER[2] ?? '']: { confirmed: [1,], },
              [ROSTER[3] ?? '']: { confirmed: [1,], },
            },
          },),
          modelIds: ROSTER,
          // WHOLE BENCH, PINNED (ledger X2): this case scripts seats by name, and
          // the window picks its seats by a hash of the prompt, so rewording the
          // fixture would change which scripted seat is heard.
          fanOut: 'whole-bench',
          sourceText: SOURCE_TEXT,
          archiveText: ARCHIVE_TEXT,
          referenceContext: REFERENCE_CONTEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(prompts.some(function isConfirm(sheet,) {
          return sheet.includes('CANDIDATE',) && sheet.includes(BROTHER_ITEM.referenceQuote,);
        },),).toBe(true,);
        expect(attestation.details,).toHaveLength(1,);
        expect(attestation.details[0]?.voices,).toBe(attestation.details[0]?.heard,);
        expect((attestation.details[0]?.voices ?? 0) >= 2,).toBe(true,);
        expect(attestation.findings.join('\n',),).toContain('confirmed 1 of 1',);
      },
    },),
    it({
      name: 'DROPS the same detail when only one of four confirms it',
      fn: async () => {
        const attestation = await attestCitedReferences({
          client: twoRoundClient({
            prompts: [],
            extraction: { [ROSTER[2] ?? '']: { attested: [BROTHER_ITEM,], }, },
            confirmation: { [ROSTER[2] ?? '']: { confirmed: [1,], }, },
          },),
          modelIds: ROSTER,
          // WHOLE BENCH, PINNED (ledger X2): this case scripts seats by name, and
          // the window picks its seats by a hash of the prompt, so rewording the
          // fixture would change which scripted seat is heard.
          fanOut: 'whole-bench',
          sourceText: SOURCE_TEXT,
          archiveText: ARCHIVE_TEXT,
          referenceContext: REFERENCE_CONTEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(attestation.details,).toHaveLength(0,);
      },
    },),
    it({
      name: 'ASKS nothing more when no voice extracted anything',
      fn: async () => {
        const prompts: string[] = [];
        await attestCitedReferences({
          client: twoRoundClient({
            prompts,
            extraction: {},
            confirmation: {},
          },),
          modelIds: ROSTER,
          // WHOLE BENCH, PINNED (ledger X2): this case scripts seats by name, and
          // the window picks its seats by a hash of the prompt, so rewording the
          // fixture would change which scripted seat is heard.
          fanOut: 'whole-bench',
          sourceText: SOURCE_TEXT,
          archiveText: ARCHIVE_TEXT,
          referenceContext: REFERENCE_CONTEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(prompts.some(function isConfirm(sheet,) {
          return sheet.includes('CANDIDATE',);
        },),).toBe(false,);
      },
    },),
    it({
      name: 'NUMBERS the candidates with both quotes on the sheet and reads back a list of numbers',
      fn: async () => {
        const messages = buildReferenceAttestConfirmMessages({
          sourceText: SOURCE_TEXT,
          archiveText: ARCHIVE_TEXT,
          referenceContext: REFERENCE_CONTEXT,
          candidates: [
            {
              ...BROTHER_ITEM,
              voices: 1,
              heard: 4,
            },
          ],
        },);
        const sheet = messages.map(function toText(message,) {
          return messageText({ message, },);
        },).join('\n',);
        expect(sheet,).toContain('CANDIDATE 1',);
        expect(sheet,).toContain(BROTHER_ITEM.archiveQuote,);
        expect(sheet,).toContain(BROTHER_ITEM.referenceQuote,);
        expect(isReferenceAttestConfirmWire({ confirmed: [1, 2,], },),).toBe(true,);
        expect(isReferenceAttestConfirmWire({ confirmed: ['1',], },),).toBe(false,);
        expect(isReferenceAttestConfirmWire({ attested: [], },),).toBe(false,);
      },
    },),
    it({
      name: 'COUNTS distinct confirming voices per candidate and keeps those at the quorum',
      fn: async () => {
        const kept = confirmedDetails({
          candidates: [
            {
              ...BROTHER_ITEM,
              voices: 1,
              heard: 4,
            },
            {
              archiveQuote: 'She wears a bell.',
              reference: 1,
              referenceQuote: 'wore a bell',
              voices: 1,
              heard: 4,
            },
          ],
          ballots: [
            {
              modelId: ROSTER[0] ?? ('' as RosterModelId),
              confirmed: [1, 1,],
            },
            {
              modelId: ROSTER[1] ?? ('' as RosterModelId),
              confirmed: [1, 2,],
            },
            {
              modelId: ROSTER[2] ?? ('' as RosterModelId),
              confirmed: [9,],
            },
          ],
          needed: 2,
        },);
        expect(kept,).toHaveLength(1,);
        expect(kept[0]?.archiveQuote,).toBe(BROTHER_ITEM.archiveQuote,);
        expect(kept[0]?.voices,).toBe(2,);
        expect(kept[0]?.heard,).toBe(3,);
      },
    },),
  ],
},);
