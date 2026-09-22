/**
 Tests for the second judging a declined slate buys.
 
 Three doors: a first judging that decides is returned as it stands with no
 second ask; a first decline followed by a decision keeps the decision and
 carries both rounds' findings; two declines settle as `no-candidate-backed`.
 The thrown door, for a slice with nothing in the archive, is covered by the
 stage suite.
 
 Fixtures are cat-themed invention.
 
 @module
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
  judgeSlateWithRetry,
  messageText,
  producerModelIds,
  produceTranslateSlate,
  type RosterModelId,
  type SyntheticClient,
  type TranslateStageResult,
} from '../dist/final/node/index.mjs';

/**
 Logger for the judgings under test.
 */
const l = tagged({ tag: 'translate-retry-test', },);

/**
 Schema name the producing half asks translators for; every other structured
 ask is a judge sheet.
 */
const TRANSLATE_SCHEMA = 'translation_report';

/**
 Original slice both halves work over.
 */
const SOURCE_TEXT = '猫猫在窗台上打盹，尾巴垂在暖气片旁边。';

/**
 Translation already in the archive, awkward but present.
 */
const INCUMBENT_TEXT = 'The cat is doing the sleeping on the windowsill, with tail hanging by the radiator.';

/**
 Models that render the slice.
 */
const TRANSLATORS: readonly RosterModelId[] = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 Judges, three so selection can reach its minimum weight.
 */
const JUDGES: readonly RosterModelId[] = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-C',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 Seat no judge holds, standing for an author before the slate exists.
 */
const NOBODY = 'hf:cat/nobody' as unknown as RosterModelId;

/**
 What the translators render, one each in call order.
 */
const RENDERINGS: readonly string[] = [
  'The cat dozes on the windowsill, tail draped beside the radiator.',
  'A cat naps on the sill, its tail hanging near the heater.',
];

/**
 Four translators for a slate wide enough to narrow twice (class
 eighty-two).
 */
const FOUR_TRANSLATORS: readonly RosterModelId[] = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-D',
  'hf:cat/Cat-E',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 Judges who rendered nothing, so every ballot carries a whole weight.
 */
const DISINTERESTED_JUDGES: readonly RosterModelId[] = [
  'hf:cat/Cat-C',
  'hf:cat/Cat-F',
  'hf:cat/Cat-G',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 Four renderings, each carrying one word the others lack.
 */
const FOUR_RENDERINGS: readonly string[] = [
  ...RENDERINGS,
  'The cat curls up on the ledge, tail tucked by the warmth.',
  'The cat yawns on the sill, tail resting against the pipe.',
];

/**
 What a scripted judge says: a rejection, or the word only the wanted
 rendering carries.
 */
type ScriptedBallot = 'reject' | 'dozes' | 'naps' | 'curls' | 'yawns';

/**
 Candidate number on a judge sheet whose block carries the needle, zero when
 none does, which is a rejection of the whole slate.
 
 @param content - judge sheet as sent
 
 @param needle - text the wanted candidate carries
 
 @returns Candidate number, or zero
 
 @example
 ```ts
 const best = pickCandidate({ content, needle: 'dozes', },);
 ```
 */
function pickCandidate(
  {
    content,
    needle,
  }: {
    readonly content: string;
    readonly needle: string;
  },
): number {
  /**
   Candidate blocks, each opening with its number.
   */
  const [, ...blocks] = content.split('CANDIDATE ',);
  for (const block of blocks) {
    /**
     Number the block opens with.
     */
    const [heading = '',] = block.split('\n',);
    const index = Math.trunc(Number(heading,),);
    if (Number.isInteger(index,) && block.includes(needle,))
      return index;
  }
  return 0;
}

/**
 Client whose translators render in call order and whose judges answer as the
 per-round script says.
 
 @param ballotFor - what the judges say, given how many judgings have been
 asked so far (the first is 1)
 
 @returns Client plus the count of judge calls made
 
 @example
 ```ts
 const rig = scriptedRig({ ballotFor: () => 'reject', },);
 ```
 */
function scriptedRig(
  {
    ballotFor,
    renderings,
    judgeCount,
  }: {
    readonly ballotFor: (judging: number, seat: RosterModelId) => ScriptedBallot;
    readonly renderings: readonly string[];
    readonly judgeCount: number;
  },
): {
  readonly client: SyntheticClient;
  readonly judgeCalls: { count: number; };
  readonly judgePrompts: string[];
} {
  /**
   Translator calls served so far.
   */
  const served = { count: 0, };

  /**
   Judge calls made so far, which says which judging this is.
   */
  const judgeCalls = { count: 0, };
  /**
   Exact model-plus-message identities across judging rounds.
   */
  const judgePrompts: string[] = [];

  return {
    judgeCalls,
    judgePrompts,
    client: {
      chatText: async () => {
        throw new Error('chatText unused by the translate lane',);
      },
      quotas: async () => {
        throw new Error('quotas unused by the translate lane',);
      },
      chatJson: async <ValueT,>(
        request: ChatJsonRequest<ValueT>,
      ): Promise<ChatJsonOutcome<ValueT>> => {
        /**
         Which sheet this is.
         */
        const schema = request.responseFormat
          ?.json_schema
          .name;
        if (schema === TRANSLATE_SCHEMA) {
          /**
           Rendering this call gets.
           */
          const translation = renderings[served.count % renderings.length] ?? '';
          served.count += 1;
          /**
           Reply as the wire expects it.
           */
          const value: unknown = { translation, };
          if (!request.validate(value,))
            throw new Error('the fixture translation failed the wire guard',);
          return {
            kind: 'ok',
            value,
            rawText: JSON.stringify(value,),
          };
        }
        judgeCalls.count += 1;
        judgePrompts.push(JSON.stringify({
          modelId: request.modelId,
          messages: request.messages,
        },),);

        /**
         Which judging this call belongs to, every judge answering once per
         judging.
         */
        const judging = Math.ceil(judgeCalls.count / judgeCount,);

        /**
         Sheet text, for finding the wanted candidate.
         */
        const content = request.messages
          .map(function toContent(message,) {
            return messageText({ message, },);
          },)
          .join('\n',);

        /**
         Ballot for this judging.
         */
        /**
         What this seat says this judging: a rejection, or the rendering it
         wants by a word only that rendering carries.
         */
        const wanted = ballotFor(
          judging,
          request.modelId,
        );
        const ballot: unknown = {
          best: (wanted === 'reject')
            ? 0
            : pickCandidate({
              content,
              needle: wanted,
            },),
          reason: 'fixture',
        };
        if (!request.validate(ballot,))
          throw new Error('the fixture ballot failed the wire guard',);
        return {
          kind: 'ok',
          value: ballot as ValueT,
          rawText: JSON.stringify(ballot,),
        };
      },
    },
  };
}

/**
 Judges one freshly produced slate through the retry, under one script.
 
 @param ballotFor - what the judges say per judging
 
 @returns Stage result plus the judge calls it cost
 
 @example
 ```ts
 const { result, } = await judgedUnder({ ballotFor: () => 'dozes', },);
 ```
 */
async function judgedUnder(
  {
    ballotFor,
    incumbentKind = 'present',
    translators = TRANSLATORS,
    judges = JUDGES,
    renderings = RENDERINGS,
  }: {
    readonly ballotFor: (
      judging: number,
      seat: RosterModelId,
      dozesAuthor: RosterModelId,
    ) => ScriptedBallot;
    readonly incumbentKind?: 'present' | 'absent';
    readonly translators?: readonly RosterModelId[];
    readonly judges?: readonly RosterModelId[];
    readonly renderings?: readonly string[];
  },
): Promise<{
  readonly result: TranslateStageResult;
  readonly judgeCalls: number;
  readonly judgePrompts: readonly string[];
}> {
  /**
   Scripted client and its counter.
   */
  /**
   Translator whose rendering carries the word the scripts ask for, known
   only once the slate is produced, since the rig renders in call order.
   */
  const author = { dozes: NOBODY, };
  const rig = scriptedRig({
    ballotFor: function withAuthor(
      judging,
      seat,
    ): ScriptedBallot {
      return ballotFor(
        judging,
        seat,
        author.dozes,
      );
    },
    renderings,
    judgeCount: judges.length,
  },);

  /**
   Slate the translators produced.
   */
  const produced = await produceTranslateSlate({
    client: rig.client,
    translatorModelIds: translators,
    sourceText: SOURCE_TEXT,
    incumbentText: INCUMBENT_TEXT,
    lineStructured: false,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);

  /**
   Translator credited first for the rendering that carries the word.
   */
  const [dozesAuthor = NOBODY,] = produced.candidates
    .filter(function carriesDozes(candidate,): boolean {
      return candidate.rendered.includes('dozes',);
    },)
    .flatMap(function toAuthors(candidate,): readonly RosterModelId[] {
      return producerModelIds(candidate.producer,);
    },);
  author.dozes = dozesAuthor;

  /**
   What the retry settled on.
   */
  const result = await judgeSlateWithRetry({
    judging: {
      client: rig.client,
      produced,
      judgeModelIds: judges,
      sourceText: SOURCE_TEXT,
      incumbentText: (incumbentKind === 'present') ? INCUMBENT_TEXT : '',
      incumbentKind,
      lineStructured: false,
      signal: AbortSignal.timeout(30_000,),
      perCallTimeoutMs: 5_000,
      l,
    },
  },);
  return {
    result,
    judgeCalls: rig.judgeCalls.count,
    judgePrompts: rig.judgePrompts,
  };
}

/**
 Finding the retry writes between the two rounds' findings.
 */
const RETRY_FINDING = 'translate-declined-retried';

await describe({
  name: judgeSlateWithRetry.name,
  children: [
    it({
      name: 'KEEPS a second judging\'s decision after a first decline, carrying the first round\'s findings and '
        + 'the retry marker, so the record shows both asks',
      fn: async () => {
        const { result, judgeCalls, judgePrompts, } = await judgedUnder({
          ballotFor: function firstRejects(judging,): 'reject' | 'dozes' {
            return (judging === 1) ? 'reject' : 'dozes';
          },
        },);

        expect(result.origin,).toBe('fresh',);
        expect(result.text.includes('dozes',),).toBe(true,);
        expect(result.findings.includes(RETRY_FINDING,),).toBe(true,);
        expect(result.findings.includes('translate-declined (rejection)',),).toBe(true,);
        expect(judgeCalls,).toBe(JUDGES.length * 2,);
        expect(new Set(judgePrompts,).size,).toBe(judgeCalls,);
      },
    },),

    it({
      name: 'SEATS the run-off leader named by two ballots under the weight minimum where the slice has no '
        + 'incumbent (class seventy-three, mikaela4 slice 28, 2026-09-19): a tie between two valid finalists, '
        + 'then Cat-A and Cat-C name the same one while Cat-B abstains',
      fn: async () => {
        // Judging 1: Cat-A names its own rendering (half), Cat-B its own
        // (half), Cat-C rejects: a tie, so the challenge is a run-off over
        // both. Judging 2: Cat-A names its own again (half), Cat-C names it
        // (full), Cat-B rejects: 1.5 from two ballots against a minimum of 2.
        const { result, judgeCalls, } = await judgedUnder({
          incumbentKind: 'absent',
          ballotFor: function splitThenLean(
            judging,
            seat,
            dozesAuthor,
          ): 'reject' | 'dozes' | 'naps' {
            /** Whether this seat rendered a candidate. */
            const wrote = TRANSLATORS.includes(seat,);
            if (judging === 1) {
              if (!wrote)
                return 'reject';
              return (seat === dozesAuthor) ? 'dozes' : 'naps';
            }
            if (!wrote)
              return 'dozes';
            return (seat === dozesAuthor) ? 'dozes' : 'reject';
          },
        },);
        expect(result.origin,).toBe('fresh',);
        expect(result.text.includes('dozes',),).toBe(true,);
        expect(result.findings.includes(RETRY_FINDING,),).toBe(true,);
        expect(result.findings.includes('select-runoff-under-minimum',),).toBe(true,);
        expect(judgeCalls,).toBe(JUDGES.length * 2,);
      },
    },),
    it({
      name: 'ASKS a run-off AGAIN while the tie keeps narrowing the finalists, and seats the round that decides '
        + '(class eighty-two, XingZ621 slice 14, 2026-09-22: eight valid candidates split 1/1/1/1, the run-off '
        + 'over the four leaders split 1/1/0.5, and the entry stopped though the tie had narrowed 4 to 2)',
      fn: async () => {
        // Judging 1: C dozes, F naps, G curls, yawns unnamed: a tie of three of
        // four. Judging 2: C dozes, F naps, G rejects: a tie of two of three.
        // Judging 3: C dozes, F dozes, G naps: dozes at weight 2.
        const { result, judgeCalls, } = await judgedUnder({
          incumbentKind: 'absent',
          translators: FOUR_TRANSLATORS,
          judges: DISINTERESTED_JUDGES,
          renderings: FOUR_RENDERINGS,
          ballotFor: function narrowTwice(
            judging,
            seat,
          ): ScriptedBallot {
            if (seat === DISINTERESTED_JUDGES[0])
              return 'dozes';
            if (seat === DISINTERESTED_JUDGES[1])
              return (judging === 3) ? 'dozes' : 'naps';
            if (judging === 1)
              return 'curls';
            return (judging === 2) ? 'reject' : 'naps';
          },
        },);
        expect(result.origin,).toBe('fresh',);
        expect(result.text.includes('dozes',),).toBe(true,);
        expect(result.findings.includes('translate-runoff (finalists 3 of 4)',),).toBe(true,);
        expect(result.findings.includes('translate-runoff (finalists 2 of 3)',),).toBe(true,);
        expect(judgeCalls,).toBe(DISINTERESTED_JUDGES.length * 3,);
      },
    },),
    it({
      name: 'asks ONCE when the first judging decides, and writes no retry marker',
      fn: async () => {
        const { result, judgeCalls, } = await judgedUnder({
          ballotFor: function alwaysDecides(): 'reject' | 'dozes' {
            return 'dozes';
          },
        },);

        expect(result.origin,).toBe('fresh',);
        expect(result.findings.includes(RETRY_FINDING,),).toBe(false,);
        expect(judgeCalls,).toBe(JUDGES.length,);
      },
    },),

    it({
      name: 'SETTLES two declines as no-candidate-backed rather than as the momentary reason, keeping the '
        + 'incumbent and both rounds\' findings',
      fn: async () => {
        const { result, judgeCalls, } = await judgedUnder({
          ballotFor: function alwaysRejects(): 'reject' | 'dozes' {
            return 'reject';
          },
        },);

        expect(result.decision,).toBe('no-candidate-backed',);
        expect(result.origin,).toBe('incumbent',);
        expect(result.text,).toBe(INCUMBENT_TEXT,);
        expect(result.findings.filter(function isRetry(finding,): boolean {
          return finding === RETRY_FINDING;
        },).length,).toBe(1,);
        expect(judgeCalls,).toBe(JUDGES.length * 2,);
      },
    },),
  ],
},);
