/**
 * Tests for what happens to a translated slice that fails structural
 * validation.
 *
 * By user decision of 2026-08-14 it is not dropped: it goes back to the model
 * that wrote it, in the same exchange, and that model answers with a revision,
 * an inability, or a defence of what it produced. Each of those three lands
 * differently, and the third is the one no filter could have collected, so all
 * three are pinned here.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  messageText,
  type VisionMessage,
  repairInvalidCandidates,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the repairs under test.
 */
const l = tagged({ tag: 'translate-repair-test', },);

/**
 * Original the candidates render: a heading and a paragraph.
 */
const SOURCE_TEXT = `## 猫猫的一天

它在窗台上打盹。`;

/**
 * Translation matching that structure.
 */
const GOOD_TEXT = `## A Day in the Cat's Life

It dozes on the windowsill.`;

/**
 * Translation that merged the heading away, which validation reports.
 */
const MERGED_TEXT = 'A day in the cat\'s life: it dozes on the windowsill.';

/**
 * Model whose candidate every case repairs.
 */
const TRANSLATOR = 'hf:moonshotai/Kimi-K3';

/**
 * Messages the candidate was produced by, stood in for since the repair turn
 * only has to continue them.
 */
const PRIOR_MESSAGES: readonly ChatMessage[] = [
  {
    role: 'system',
    content: 'Render the ORIGINAL passage into English.',
  },
  {
    role: 'user',
    content: SOURCE_TEXT,
  },
];

/**
 * What the follow-up call saw and answered.
 */
type RepairLog = {
  calls: number;
  messages: readonly (ChatMessage | VisionMessage)[];
};

/**
 * Client answering the follow-up turn from a script.
 *
 * @param answer - repair reply it returns
 *
 * @param log - shared record the cases assert on
 *
 * @returns Client honoring that script
 *
 * @example
 * ```ts
 * const client = repairClient({ answer, log, },);
 * ```
 */
function repairClient(
  {
    answer,
    log,
  }: {
    readonly answer: unknown;
    readonly log: RepairLog;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      log.calls += 1;
      log.messages = request.messages;
      if (!request.validate(answer,)) {
        return {
          kind: 'schema-mismatch',
          rawText: JSON.stringify(answer,),
          detail: 'scripted answer failed the repair guard',
        };
      }
      return {
        kind: 'ok',
        value: answer,
        rawText: JSON.stringify(answer,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 * Runs one candidate through validation and any follow-up it earns.
 *
 * @param translation - what the translator returned
 *
 * @param answer - what it answers when asked about the findings
 *
 * @param incumbentText - translation already in the document, blank by default
 * so most cases exercise a slice with none
 *
 * @returns Final voices, findings, and what the follow-up call saw
 *
 * @example
 * ```ts
 * const { findings, } = await runRepair({ translation, answer, },);
 * ```
 */
async function runRepair(
  {
    translation,
    answer,
    incumbentText = '',
  }: {
    readonly translation: string;
    readonly answer: unknown;
    readonly incumbentText?: string;
  },
) {
  /**
   * What the follow-up call received.
   */
  const log: RepairLog = {
    calls: 0,
    messages: [],
  };

  /**
   * Outcome over one heard voice.
   */
  const repaired = await repairInvalidCandidates({
    client: repairClient({
      answer,
      log,
    },),
    voices: [
      {
        modelId: TRANSLATOR,
        value: { translation, },
      },
    ],
    sourceText: SOURCE_TEXT,
    incumbentText,
    priorMessages: PRIOR_MESSAGES,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
  return {
    repaired,
    log,
  };
}

await describe({
  name: repairInvalidCandidates.name,
  children: [
    it({
      name: 'asks NOBODY anything when the candidate matches its original, '
        + 'which is the ordinary case and has to cost nothing: a follow-up per '
        + 'candidate per slice would double the lane on work that was already '
        + 'right',
      fn: async () => {
        const { repaired, log, } = await runRepair({
          translation: GOOD_TEXT,
          answer: {
            resolution: 'revised',
            translation: 'unused',
            explanation: 'unused',
          },
        },);
        expect(log.calls,).toBe(0,);
        expect(repaired.findings,).toHaveLength(0,);
        expect(repaired.voices[0]?.value.translation,).toBe(GOOD_TEXT,);
      },
    },),

    it({
      name: 'leaves a candidate that REPRODUCED THE INCUMBENT alone, however '
        + 'the incumbent scores. That text is about to collapse into the '
        + 'incumbent, which is never validated, so asking about it would spend '
        + 'a call on text nobody will ship; and a revision would break the '
        + 'match, erasing the one signal that says a translation was examined '
        + 'and kept rather than never looked at',
      fn: async () => {
        const { repaired, log, } = await runRepair({
          translation: MERGED_TEXT,
          incumbentText: MERGED_TEXT,
          answer: {
            resolution: 'revised',
            translation: GOOD_TEXT,
            explanation: 'restored the heading',
          },
        },);
        expect(log.calls,).toBe(0,);
        expect(repaired.findings,).toHaveLength(0,);
        expect(repaired.voices[0]?.value.translation,).toBe(MERGED_TEXT,);
      },
    },),

    it({
      name: 'still asks about a candidate that only RESEMBLES the incumbent, '
        + 'since the collapse it would merge into never happens and the '
        + 'candidate reaches the ballot on its own',
      fn: async () => {
        const { log, } = await runRepair({
          translation: MERGED_TEXT,
          incumbentText: `${MERGED_TEXT} It naps.`,
          answer: {
            resolution: 'unable',
            translation: '',
            explanation: 'the heading is not a sentence in English',
          },
        },);
        expect(log.calls,).toBe(1,);
      },
    },),

    it({
      name: 'continues the SAME exchange, carrying the model\'s own turn and '
        + 'then the findings. Asking in a fresh conversation would ask a model '
        + 'about text it cannot see, which is a different question with a '
        + 'worse answer',
      fn: async () => {
        const { log, } = await runRepair({
          translation: MERGED_TEXT,
          answer: {
            resolution: 'unable',
            translation: '',
            explanation: 'the heading is not a sentence in English',
          },
        },);
        expect(log.calls,).toBe(1,);
        expect(log.messages,).toHaveLength(PRIOR_MESSAGES.length + 2,);
        expect(log.messages[PRIOR_MESSAGES.length]?.role,).toBe('assistant',);
        /**
         * The merged assistant turn, whose text carries the candidate.
         */
        const merged = log.messages[PRIOR_MESSAGES.length];
        if (merged === undefined)
          throw new Error('a merged turn by construction',);
        expect(messageText({ message: merged, },),).toContain(MERGED_TEXT,);
        /**
         * The final turn, whose text names the structure being asked about.
         */
        const asked = log.messages.at(-1,);
        if (asked === undefined)
          throw new Error('a final turn by construction',);
        expect(messageText({ message: asked, },),).toContain('heading (level 2)',);
      },
    },),

    it({
      name: 'TAKES a revision that resolves the findings, which is the whole '
        + 'point of asking rather than dropping: the candidate reaches the '
        + 'judges as the model meant it',
      fn: async () => {
        const { repaired, } = await runRepair({
          translation: MERGED_TEXT,
          answer: {
            resolution: 'revised',
            translation: GOOD_TEXT,
            explanation: 'restored the heading',
          },
        },);
        expect(repaired.voices[0]?.value.translation,).toBe(GOOD_TEXT,);
        expect(repaired.findings,).toContain(`translate-repair-revised (${TRANSLATOR})`,);
      },
    },),

    it({
      name: 'REFUSES a revision that still fails, keeping the original. The '
        + 'model was asked to fix these findings and did not, so nothing says '
        + 'the new text is better, while the original is at least what it '
        + 'produced with the whole sheet in front of it',
      fn: async () => {
        const { repaired, } = await runRepair({
          translation: MERGED_TEXT,
          answer: {
            resolution: 'revised',
            translation: 'Still one paragraph, still no heading.',
            explanation: 'tried',
          },
        },);
        expect(repaired.voices[0]?.value.translation,).toBe(MERGED_TEXT,);
        expect(
          repaired.findings.some(function isUnresolved(finding,) {
            return finding.startsWith(`translate-repair-unresolved (${TRANSLATOR})`,);
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'KEEPS the candidate and records the reason when the model says '
        + 'the finding is about the passage rather than its work. This is the '
        + 'answer no filter could collect: a marker whose definition is not in '
        + 'this slice is a report about the SLICING, and dropping the '
        + 'candidate would have destroyed the only copy of it',
      fn: async () => {
        const { repaired, } = await runRepair({
          translation: MERGED_TEXT,
          answer: {
            resolution: 'as-intended',
            translation: '',
            explanation: 'the original heading is a caption, not a section title',
          },
        },);
        expect(repaired.voices[0]?.value.translation,).toBe(MERGED_TEXT,);
        expect(
          repaired.findings.some(function isAsIntended(finding,) {
            return finding.includes('translate-repair-as-intended',)
              && finding.includes('caption',);
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'keeps the candidate when the follow-up itself is lost, and says '
        + 'so, since a silent stage reads identically to one that found '
        + 'nothing to ask about',
      fn: async () => {
        const { repaired, } = await runRepair({
          translation: MERGED_TEXT,
          answer: { nonsense: true, },
        },);
        expect(repaired.voices[0]?.value.translation,).toBe(MERGED_TEXT,);
        expect(repaired.findings,).toContain(`translate-repair-unheard (${TRANSLATOR})`,);
      },
    },),
  ],
},);
