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
  CANDIDATE_NONE,
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
 * What a scripted judge does with its ballot: back one of the texts, or name no
 * candidate at all.
 */
type ScriptedVote = ScriptedPick | 'decline';

/**
 * Builds a client whose judges vote by TEXT rather than by position, each one
 * following its own entry in the script, so a test states a judge behaviour and
 * a mixed roster is expressible.
 *
 * @param script - vote per roster model id
 *
 * @returns Client the trial can be driven with
 *
 * @example
 * ```ts
 * const client = judgesVoting({ script: { 'hf:cat/Cat-A': 'decline', },  },);
 * ```
 */
function judgesVoting(
  { script, }: { readonly script: Readonly<Record<string, ScriptedVote>>; },
): SyntheticClient {
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
       * What this particular judge was told to do.
       */
      const vote = script[request.modelId];
      if (vote === undefined)
        throw new Error(`no scripted vote for ${request.modelId}`,);

      /**
       * Ballot position this judge is scripted to back, one-based, or
       * `CANDIDATE_NONE` where it names nothing.
       */
      const wantedPosition = (vote === 'decline')
        ? CANDIDATE_NONE
        : (((vote === 'clean') === cleanIsFirst) ? 1 : 2);

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
 * Script in which every judge does the same thing.
 *
 * @param vote - what the whole roster does
 *
 * @returns Script covering every roster model
 *
 * @example
 * ```ts
 * const script = wholeRoster({ vote: 'decline', },);
 * ```
 */
function wholeRoster({ vote, }: { readonly vote: ScriptedVote; },): Record<string, ScriptedVote> {
  return Object.fromEntries(ROSTER.map(function toEntry(modelId,) {
    return [
      modelId,
      vote,
    ];
  },),);
}

/**
 * Runs one trial against a scripted roster.
 *
 * @param script - vote per roster model id
 *
 * @param direction - which side holds the clean text
 *
 * @param cleanFirst - whether the clean text is listed first
 *
 * @returns Trial outcome
 *
 * @example
 * ```ts
 * const outcome = await runScripted({ script, direction: 'preserve', cleanFirst: true, },);
 * ```
 */
async function runScripted(
  {
    script,
    direction,
    cleanFirst,
  }: {
    readonly script: Readonly<Record<string, ScriptedVote>>;
    readonly direction: FidelityDirection;
    readonly cleanFirst: boolean;
  },
) {
  return await runFidelityTrial({
    client: judgesVoting({ script, },),
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

/**
 * Runs one trial where every judge backs the same text.
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
  return await runScripted({
    script: wholeRoster({ vote: pick, },),
    direction,
    cleanFirst,
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
    it({
      name: 'reads an ABSTAINING ballot as declined rather than as a vote for the deletion, which is '
        + 'what naming no candidate would otherwise collapse into',
      fn: async () => {
        /**
         * One judge names nothing while the other two back the complete text,
         * which still carries the trial at full weight.
         */
        const outcome = await runScripted({
          script: {
            'hf:cat/Cat-A': 'decline',
            'hf:cat/Cat-B': 'clean',
            'hf:cat/Cat-C': 'clean',
          },
          direction: 'preserve',
          cleanFirst: true,
        },);
        expect(outcome.verdict,).toBe('clean',);
        expect(outcome.correct,).toBe(true,);
        expect(outcome.ballots
          .map(function toPick(ballot,) {
            return ballot.picked;
          },),).toEqual([
            'declined',
            'clean',
            'clean',
          ],);
      },
    },),
    it({
      name: 'counts a roster that WHOLLY DECLINES as incorrect, so an abstention never reads as '
        + 'having found the deletion',
      fn: async () => {
        /** Every judge names nothing, which leaves the trial without a winner. */
        const outcome = await runScripted({
          script: wholeRoster({ vote: 'decline', },),
          direction: 'preserve',
          cleanFirst: true,
        },);
        expect(outcome.verdict,).toBe('declined',);
        expect(outcome.correct,).toBe(false,);
        expect(outcome.declineReason,).toBe('every judge declined',);
        expect(outcome.ballots
          .every(function abstained(ballot,) {
            return ballot.picked === 'declined';
          },),).toBe(true,);
      },
    },),
    it({
      name: 'counts a roster SHORT OF THE MINIMUM WEIGHT as incorrect even where the single judge '
        + 'that voted named the complete text, since one voice does not carry a stage',
      fn: async () => {
        /**
         * One judge backs the complete text and the rest abstain, which draws
         * `FULL_VOTE_WEIGHT` against a minimum of `MIN_SELECTION_WEIGHT`.
         */
        const outcome = await runScripted({
          script: {
            'hf:cat/Cat-A': 'clean',
            'hf:cat/Cat-B': 'decline',
            'hf:cat/Cat-C': 'decline',
          },
          direction: 'preserve',
          cleanFirst: true,
        },);
        expect(outcome.verdict,).toBe('declined',);
        expect(outcome.correct,).toBe(false,);
        expect(outcome.declineReason,).toBe('winner short of the minimum vote weight',);
        // The ballot still records what that judge chose, which is the reading
        // that separates a panel nobody voted in from one that could not agree.
        expect(outcome.ballots
          .map(function toPick(ballot,) {
            return ballot.picked;
          },),).toEqual([
            'clean',
            'declined',
            'declined',
          ],);
      },
    },),
  ],
},);
