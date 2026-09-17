/**
 Guards class forty-three (Mio26, 2026-09-17): a detail one voice extracted
 and both quotes verified is put to the bench again as a yes-or-no candidate,
 and the voices that answered the open question with an empty list get to
 confirm it. Fixtures are cat-themed invention. No corpus content appears
 here.

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
 Original naming a sister and nothing more about her.
 */
const SOURCE_TEXT = '猫有一个姐姐。';

/**
 Archive carrying the detail the reference states.
 */
const ARCHIVE_TEXT = 'The cat has an older sister who is also a tabby.';

/**
 One reference stating it.
 */
const REFERENCE_CONTEXT = 'REFERENCE 1 https://example.invalid/cat-diary: Mittens had an older sister who was also a tabby.';

/**
 The item one voice extracts.
 */
const SISTER_ITEM = {
  archiveQuote: 'an older sister who is also a tabby',
  reference: 1,
  referenceQuote: 'an older sister who was also a tabby',
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
      name: 'KEEPS a detail one voice extracted when three of four confirm it, and the extraction quorum alone would have dropped it',
      fn: async () => {
        const prompts: string[] = [];
        const attestation = await attestCitedReferences({
          client: twoRoundClient({
            prompts,
            extraction: { [ROSTER[2] ?? '']: { attested: [SISTER_ITEM,], }, },
            confirmation: {
              [ROSTER[0] ?? '']: { confirmed: [1,], },
              [ROSTER[1] ?? '']: { confirmed: [1,], },
              [ROSTER[2] ?? '']: { confirmed: [1,], },
            },
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          archiveText: ARCHIVE_TEXT,
          referenceContext: REFERENCE_CONTEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(prompts.some(function isConfirm(sheet,) {
          return sheet.includes('CANDIDATE',) && sheet.includes(SISTER_ITEM.referenceQuote,);
        },),).toBe(true,);
        expect(attestation.details,).toHaveLength(1,);
        expect(attestation.details[0]?.voices,).toBe(3,);
        expect(attestation.findings.join('\n',),).toContain('confirmed 1 of 1',);
      },
    },),
    it({
      name: 'DROPS the same detail when only one of four confirms it',
      fn: async () => {
        const attestation = await attestCitedReferences({
          client: twoRoundClient({
            prompts: [],
            extraction: { [ROSTER[2] ?? '']: { attested: [SISTER_ITEM,], }, },
            confirmation: { [ROSTER[2] ?? '']: { confirmed: [1,], }, },
          },),
          modelIds: ROSTER,
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
              ...SISTER_ITEM,
              voices: 1,
              heard: 4,
            },
          ],
        },);
        const sheet = messages.map(function toText(message,) {
          return messageText({ message, },);
        },).join('\n',);
        expect(sheet,).toContain('CANDIDATE 1',);
        expect(sheet,).toContain(SISTER_ITEM.archiveQuote,);
        expect(sheet,).toContain(SISTER_ITEM.referenceQuote,);
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
              ...SISTER_ITEM,
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
        expect(kept[0]?.archiveQuote,).toBe(SISTER_ITEM.archiveQuote,);
        expect(kept[0]?.voices,).toBe(2,);
        expect(kept[0]?.heard,).toBe(3,);
      },
    },),
  ],
},);
