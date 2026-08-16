/**
 * Tests for the constructed comparison that asks whether the translate judges
 * can tell a complete rendering from one missing a sentence.
 *
 * What these pin is that the trial SCORES what came back rather than where it
 * sat: the same judge behaviour must read as correct in one direction and wrong
 * in the other, and a decline must never be counted as a hit.
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
  type FidelityDirection,
  runFidelityTrial,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger the trial writes its progress to.
 */
const l = tagged({ tag: 'judge-fidelity-test', },);

/**
 * Complete English for the fixture slice.
 */
const CLEAN_TEXT = 'The cat sleeps on the windowsill each morning. She watches the birds outside.\n';

/**
 * Same English with the second sentence deleted.
 */
const DAMAGED_TEXT = 'The cat sleeps on the windowsill each morning.\n';

/**
 * Sentence the deletion removed, so it appears in the complete text alone.
 */
const CLEAN_ONLY_SENTENCE = 'She watches the birds outside.';

/**
 * Chinese the candidates claim to render.
 */
const SOURCE_TEXT = '小猫每天早上在窗台上睡觉。她看着外面的鸟。\n';

/**
 * Roster the ballots go to.
 */
const ROSTER = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-C',
].map(function toModelId(id,): SyntheticModelId {
  return id as unknown as SyntheticModelId;
},);

/**
 * Which text a scripted judge votes for.
 */
type ScriptedPick = 'clean' | 'damaged';

/**
 * Builds a client whose judges all vote for the same TEXT, whatever position it
 * occupies, so a test states a judge behaviour rather than a ballot index.
 *
 * @param pick - text every judge votes for
 *
 * @returns Client the trial can be driven with
 *
 * @example
 * ```ts
 * const client = judgesPicking({ pick: 'clean', },);
 * ```
 */
function judgesPicking({ pick, }: { readonly pick: ScriptedPick; },): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by selection',);
    },
    quotas: async () => {
      throw new Error('quotas unused by selection',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Whole sheet the judge was sent, which carries both candidates.
       */
      const sheet = request.messages
        .map(function toContent(message,) {
          return message.content;
        },)
        .join('\n',);

      /**
       * Where the second candidate begins, which the sheet labels.
       *
       * READ RATHER THAN ASSUMED, because the trial rotates the ballot and a
       * scripted judge that voted by position would agree with itself no matter
       * what the trial did with the texts.
       */
      const secondAt = sheet.indexOf('CANDIDATE 2',);

      /**
       * Whether the complete text is the first candidate, decided by a sentence
       * only it carries. The deletion is otherwise a PREFIX of the complete
       * text, so searching for either whole text finds the same position.
       */
      const cleanIsFirst = sheet.indexOf(CLEAN_ONLY_SENTENCE,) < secondAt;

      /**
       * Ballot position this judge is scripted to back, one-based.
       */
      const wantedPosition = ((pick === 'clean') === cleanIsFirst) ? 1 : 2;

      /**
       * Wire value carrying that vote.
       */
      const value: unknown = {
        best: wantedPosition,
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
  };
}

/**
 * Runs one trial against a scripted roster.
 *
 * @param pick - text every judge backs
 *
 * @param direction - which side holds the clean text
 *
 * @param cleanFirst - whether the clean text is listed first
 *
 * @returns Trial outcome
 *
 * @example
 * ```ts
 * const outcome = await trial({ pick: 'clean', direction: 'preserve', cleanFirst: true, },);
 * ```
 */
async function trial(
  {
    pick,
    direction,
    cleanFirst,
  }: {
    readonly pick: ScriptedPick;
    readonly direction: FidelityDirection;
    readonly cleanFirst: boolean;
  },
) {
  return await runFidelityTrial({
    client: judgesPicking({ pick, },),
    trial: {
      trialId: 'cat/0',
      direction,
      sourceText: SOURCE_TEXT,
      cleanText: CLEAN_TEXT,
      damagedText: DAMAGED_TEXT,
      cleanFirst,
    },
    judgeModelIds: ROSTER,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);
}

await describe({
  name: runFidelityTrial.name,
  children: [
    it({
      name: 'scores the COMPLETE text correct in both directions, so a roster that reads is not '
        + 'confused with one that keeps whatever it was handed',
      fn: async () => {
        /** One outcome per direction, both scripted to back the complete text. */
        const outcomes = await Promise.all([
          trial({
            pick: 'clean',
            direction: 'preserve',
            cleanFirst: true,
          },),
          trial({
            pick: 'clean',
            direction: 'replace',
            cleanFirst: true,
          },),
        ],);
        for (const outcome of outcomes) {
          expect(outcome.verdict,).toBe('clean',);
          expect(outcome.correct,).toBe(true,);
        }
      },
    },),
    it({
      name: 'scores the DELETION wrong in both directions, including the one where choosing it means '
        + 'replacing good archive text with a shorter rendering',
      fn: async () => {
        /** One outcome per direction, both scripted to back the deletion. */
        const outcomes = await Promise.all([
          trial({
            pick: 'damaged',
            direction: 'preserve',
            cleanFirst: true,
          },),
          trial({
            pick: 'damaged',
            direction: 'replace',
            cleanFirst: true,
          },),
        ],);
        for (const outcome of outcomes) {
          expect(outcome.verdict,).toBe('damaged',);
          expect(outcome.correct,).toBe(false,);
        }
      },
    },),
    it({
      name: 'reads the same behaviour the same way when the clean text is listed SECOND, so ballot '
        + 'position cannot be mistaken for judgement',
      fn: async () => {
        const outcome = await trial({
          pick: 'clean',
          direction: 'preserve',
          cleanFirst: false,
        },);
        expect(outcome.verdict,).toBe('clean',);
        expect(outcome.correct,).toBe(true,);
        expect(outcome.cleanFirst,).toBe(false,);
        expect(outcome.ballots
          .every(function backedClean(ballot,) {
            return ballot.picked === 'clean';
          },),).toBe(true,);
      },
    },),
  ],
},);
