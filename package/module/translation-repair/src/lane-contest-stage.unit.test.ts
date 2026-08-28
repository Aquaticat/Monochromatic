/**
 * Tests for the lane contest: what the roster has to agree on before one
 * candidate is called the winner, and what a decline means.
 *
 * WHY DECLINING IS COUNTED RATHER THAN DISCARDED. A judge answering `neither`
 * has said something: that the two candidates differ only in wording. Treating
 * that as a lost voice would make an undecidable slice indistinguishable from
 * an unanswered one, and those need opposite handling.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  contestLaneSlice,
  createSyntheticClient,
  settleArchiveBallots,
} from '../dist/final/node/index.mjs';

/**
 * One contested slice, standing in for a corpus passage.
 */
const SUBJECT = {
  sourceText: '猫睡了。',
  incumbentText: 'The cat slept all afternoon in the sun.',
  repairText: 'The cat slept all afternoon.',
  translateText: 'The cat slept.',
};

/**
 * Roster of three, the smallest that can produce a two-to-one split.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Roster with two delayed eligible voices after two fast inadmissible ones.
 */
const ELIGIBILITY_ROSTER = [
  ...ROSTER,
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
] as const;

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'lane-contest-stage-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Builds one ballot body.
 *
 * @param choice - candidate this judge names
 *
 * @returns Reply body a judge would return
 *
 * @example
 * ```ts
 * const body = ballot({ choice: 'repair', },);
 * ```
 */
function ballot({ choice, }: { readonly choice: string; },): string {
  return JSON.stringify({
    choice,
    unsupported: [],
    dropped: [],
    reason: 'the original supports it',
  },);
}

/**
 * Builds a client whose models reply in roster order.
 *
 * @param replyByModel - reply body per model
 *
 * @param delayByModel - response delay per model position
 *
 * @returns Client over a canned transport
 *
 * @example
 * ```ts
 * const client = cannedClient({ replyByModel: [ballot({ choice: 'repair', },),], },);
 * ```
 */
function cannedClient(
  {
    replyByModel,
    delayByModel = [],
  }: {
    readonly replyByModel: readonly string[];
    readonly delayByModel?: readonly number[];
  },
) {
  /**
   * Calls served so far, so each model gets its own reply.
   */
  const served: string[] = [];
  return createSyntheticClient({
    apiKey: 'test-key',
    transport: async function cannedTransport(exchange,) {
      /**
       * Which reply this call receives.
       */
      const at = served.length;
      served.push(exchange.label,);

      /**
       * This model's reply text.
       */
      const content = replyByModel[at] ?? replyByModel[0] ?? '';
      await wait(delayByModel[at] ?? 0,);
      return {
        status: 200,
        bodyText: `data: ${
          JSON.stringify({
            choices: [
              {
                index: 0,
                delta: { content, },
              },
            ],
          },)
        }\n\ndata: [DONE]\n\n`,
      };
    },
  },);
}

/**
 * Runs one contest over a canned roster.
 *
 * @param replyByModel - reply body per model
 *
 * @returns What the roster settled on
 *
 * @example
 * ```ts
 * const outcome = await contest({ replyByModel: [], },);
 * ```
 */
async function contest(
  { replyByModel, }: { readonly replyByModel: readonly string[]; },
) {
  return await contestLaneSlice({
    client: cannedClient({ replyByModel, },),
    modelIds: ROSTER,
    subject: SUBJECT,
    signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS,),
    exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
    l,
  },);
}

await describe({
  name: contestLaneSlice.name,
  children: [
    it({
      name: 'SHIPS the candidate two judges named against one for the other',
      fn: async () => {
        const outcome = await contest({
          replyByModel: [
            ballot({ choice: 'repair', },),
            ballot({ choice: 'repair', },),
            ballot({ choice: 'translate', },),
          ],
        },);
        expect(outcome.choice,).toBe('repair',);
        expect(outcome.usable,).toBe(3,);
        expect(outcome.findings,).toEqual([],);
      },
    },),
    it({
      name: 'WAITS FOR DELAYED ELIGIBLE VOICES before grace after fast inadmissible quorum',
      fn: async () => {
        const outcome = await contestLaneSlice({
          client: cannedClient({
            replyByModel: [
              ballot({ choice: 'repair', },),
              ballot({ choice: 'repair', },),
              ballot({ choice: 'translate', },),
              ballot({ choice: 'translate', },),
            ],
            delayByModel: [
              0,
              0,
              30,
              30,
            ],
          },),
          modelIds: ELIGIBILITY_ROSTER,
          subject: {
            ...SUBJECT,
            ineligibleCandidates: ['repair',],
          },
          signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS,),
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          graceMs: 5,
          l,
        },);
        expect(outcome.usable,).toBe(4,);
        expect(outcome.ballots.filter(function choseTranslate(ballotValue,): boolean {
          return ballotValue.choice === 'translate';
        },),).toHaveLength(2,);
      },
    },),

    it({
      name: 'REFUSES to ship on a tie, rather than picking by list order',
      fn: async () => {
        // A CANDIDATE THAT TIES HAS NOT BEEN CHOSEN. Shipping either here would
        // be deciding what a reader sees on a memorial page by which lane the
        // code happens to name first.
        const outcome = await contest({
          replyByModel: [
            ballot({ choice: 'repair', },),
            ballot({ choice: 'translate', },),
            ballot({ choice: 'neither', },),
          ],
        },);
        expect(outcome.choice,).toBe('neither',);
        expect(outcome.usable,).toBe(3,);
      },
    },),
    it({
      name: 'REFUSES a candidate only ONE judge named, however the rest split',
      fn: async () => {
        const outcome = await contest({
          replyByModel: [
            ballot({ choice: 'repair', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
          ],
        },);
        expect(outcome.choice,).toBe('neither',);
      },
    },),
    it({
      name: 'READS a unanimous decline as a settled verdict, with NO finding',
      fn: async () => {
        // THE DISTINCTION THE FINDING EXISTS FOR: three judges saying the
        // candidates are equally faithful is a decided slice. Three judges
        // never answering is not, and only the second is a finding.
        const outcome = await contest({
          replyByModel: [
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
          ],
        },);
        expect(outcome.choice,).toBe('neither',);
        expect(outcome.usable,).toBe(3,);
        expect(outcome.findings,).toEqual([],);
      },
    },),
    it({
      name: 'REPORTS a finding when too few ballots survived to settle anything',
      fn: async () => {
        const outcome = await contest({
          replyByModel: [
            ballot({ choice: 'repair', },),
            'not json at all',
            'also not json',
          ],
        },);
        expect(outcome.choice,).toBe('neither',);
        expect(outcome.usable,).toBe(1,);
        expect(outcome.findings.length,).toBe(1,);
      },
    },),
    it({
      name: 'KEEPS the findings each judge reported, for the audit trail',
      fn: async () => {
        const outcome = await contest({
          replyByModel: [
            JSON.stringify({
              choice: 'translate',
              unsupported: [ 'repair', ],
              dropped: [],
              reason: 'the repair candidate adds an afternoon the original never mentions',
            },),
            JSON.stringify({
              choice: 'translate',
              unsupported: [ 'repair', ],
              dropped: [],
              reason: 'same',
            },),
            ballot({ choice: 'neither', },),
          ],
        },);
        expect(outcome.choice,).toBe('translate',);
        expect(outcome.ballots.at(0,)?.unsupported,).toEqual([ 'repair', ],);
      },
    },),
  ],
},);

/**
 * Builds one ballot body that also answers the archive question.
 *
 * @param choice - candidate this judge names
 *
 * @param archive - what this judge makes of the archive rendering
 *
 * @returns Reply body a judge would return
 *
 * @example
 * ```ts
 * const body = archiveBallot({ choice: 'neither', archive: 'flawed', },);
 * ```
 */
function archiveBallot(
  {
    choice,
    archive,
  }: {
    readonly choice: string;
    readonly archive: string;
  },
): string {
  return JSON.stringify({
    choice,
    unsupported: [],
    dropped: [],
    reason: 'the original supports it',
    archive,
  },);
}

/**
 * Runs one contest over a slice whose archive rendering is absent.
 *
 * @param replyByModel - reply body per model
 *
 * @returns What the roster settled on
 *
 * @example
 * ```ts
 * const outcome = await contestWithNoArchive({ replyByModel: [], },);
 * ```
 */
async function contestWithNoArchive(
  { replyByModel, }: { readonly replyByModel: readonly string[]; },
) {
  return await contestLaneSlice({
    client: cannedClient({ replyByModel, },),
    modelIds: ROSTER,
    subject: {
      ...SUBJECT,
      incumbentText: '',
    },
    signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS,),
    exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
    l,
  },);
}

await describe({
  name: 'archive answers on a slice with no archive',
  children: [
    it({
      name: 'KEEPS THE ANSWERS where an archive rendering exists, which is the positive control: '
        + 'without it, a stripped result would look the same as a roster that never answered',
      fn: async () => {
        const outcome = await contest({
          replyByModel: [
            archiveBallot({ choice: 'neither', archive: 'flawed', },),
            archiveBallot({ choice: 'neither', archive: 'flawed', },),
            archiveBallot({ choice: 'neither', archive: 'flawed', },),
          ],
        },);

        expect(settleArchiveBallots({ ballots: outcome.ballots, },),).toBe('declined',);
      },
    },),

    it({
      name: 'DROPS THE ANSWERS where the archive rendering is absent, because the sheet then shows '
        + 'judges an empty block while the schema still asks whether it is publishable, so the '
        + 'answers that come back are about nothing at all',
      fn: async () => {
        const outcome = await contestWithNoArchive({
          replyByModel: [
            archiveBallot({ choice: 'neither', archive: 'flawed', },),
            archiveBallot({ choice: 'neither', archive: 'flawed', },),
            archiveBallot({ choice: 'neither', archive: 'flawed', },),
          ],
        },);

        expect(settleArchiveBallots({ ballots: outcome.ballots, },),).toBe('unjudged',);
        expect(outcome.usable,).toBe(3,);
        expect(outcome.choice,).toBe('neither',);
      },
    },),
  ],
},);
