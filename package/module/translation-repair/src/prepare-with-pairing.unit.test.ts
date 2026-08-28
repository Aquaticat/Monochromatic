/**
 * Tests for the shell that buys a pairing and hands it to preparation.
 *
 * WHAT THESE PIN is the two things a settled entry now keeps about its pairing:
 * the correspondences themselves, echoed back out of the map preparation
 * consumed, and how many voices stood behind them, which was logged and never
 * recorded. A section two voices paired and one six voices paired are different
 * evidence about the same slicing.
 *
 * THE VOICE COUNT CARRIES ITS SECTION. The stage is asked one section at a time
 * and cannot say which, so counts filed from there would arrive as a run of
 * identical-shaped lines naming no section at all.
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
  createSyntheticClient,
  type PairedSectionRecord,
  prepareDocumentPairWithRoster,
  type SliceCache,
} from '../dist/final/node/index.mjs';

/**
 * Original side, two blocks so the section is worth a question.
 */
const SOURCE_TEXT = '猫睡在盒子里。\n\n它整个下午都没有动。';

/**
 * Translation side, two blocks against the two originals.
 */
const TARGET_TEXT = 'The cat slept in the box.\n\nShe did not move all afternoon.';

/**
 * Roster of two, which is the smallest that can agree.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Logger for the shell under test.
 */
const l = tagged({ tag: 'prepare-with-pairing-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Builds a client whose models reply in turn with the given bodies.
 *
 * @param replyByModel - reply body per call, in the order calls are made
 *
 * @returns Client over a canned transport
 *
 * @example
 * ```ts
 * const client = cannedClient({ replyByModel: ['{"pairs":[]}',], },);
 * ```
 */
function cannedClient(
  { replyByModel, }: { readonly replyByModel: readonly string[]; },
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
 * Builds client that fails if cache path buys any exchange.
 *
 * @returns Client refusing every transport call
 *
 * @example
 * ```ts
 * const client = refusingClient();
 * ```
 */
function refusingClient(): ReturnType<typeof createSyntheticClient> {
  return createSyntheticClient({
    apiKey: 'test-key',
    transport: async function refuseTransport(): Promise<never> {
      throw new Error('cached preparation bought an exchange',);
    },
  },);
}

/**
 * Builds a pairing cache backed by a map that outlives one run.
 *
 * ROUND-TRIPS THROUGH THE SERIALIZATION rather than storing the record by
 * reference, because the defect under test is a record whose findings never
 * reached disk. A stub that kept the object would pass while the bytes carried
 * only pairs.
 *
 * @param stored - map surviving between the two runs of a case
 *
 * @returns Cache resuming from `stored` and writing back into it
 *
 * @example
 * ```ts
 * const cache = memoryPairingCache({ stored, },);
 * ```
 */
function memoryPairingCache(
  { stored, }: { readonly stored: Map<string, PairedSectionRecord>; },
): SliceCache<PairedSectionRecord> {
  return {
    resumed: stored,
    persist: async ({ key, serialized, },) => {
      stored.set(
        key,
        JSON.parse(serialized,) as PairedSectionRecord,
      );
    },
  };
}

await describe({
  name: prepareDocumentPairWithRoster.name,
  children: [
    it({
      name:
        'ECHOES THE AGREED PAIRING back on the preparation, so the record a settled entry keeps is the '
        + 'object slicing consumed rather than a second copy assembled beside it',
      fn: async () => {
        const { prepared, } = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(prepared.blockPairing,).toEqual([{
          sectionIndex: 0,
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 1,
            },
          ],
        },],);
      },
    },),
    it({
      name: 'ATTACHES DETAILS TRANSCRIPT TO MATCHED MEDIA ON COLD AND WARM PREPARATION so picture evidence reaches quality stages and cached pairing cannot bypass normalization',
      fn: async () => {
        /**
         * Literal site path placeholder.
         */
        const pathToken = [
          '$',
          '{path}',
        ].join('',);
        /**
         * Shared source and target media marker.
         */
        const media = `<PhotoScroll photos={[ '${pathToken}/photos/letter.webp']} />`;
        /**
         * Source fixture with image carrying letter.
         */
        const sourceText = `About the cat.\n\n${media}\n\nRemember the cat.`;
        /**
         * Archive fixture with details transcript before same image.
         */
        const targetText = `About the cat.\n\n<details>\n<summary>Letter</summary>\n> Translated letter.\n</details>\n\n${media}\n\nRemember the cat.`;
        /**
         * Cache shared across cold and warm preparation.
         */
        const stored = new Map<string, PairedSectionRecord>();
        const pairingCache = memoryPairingCache({ stored, },);

        const first = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":3},{"source":2,"target":4}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":3},{"source":2,"target":4}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText,
          targetText,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
          pairingCache,
        },);
        const resumed = await prepareDocumentPairWithRoster({
          client: refusingClient(),
          modelIds: ROSTER,
          sourceText,
          targetText,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
          pairingCache,
        },);

        expect(first.prepared.unclaimedTargetBlocks,).toEqual([]);
        expect(first.prepared.slices.some(function carriesTranscript(slice,): boolean {
          return slice.target.text.includes('Translated letter.',);
        },),).toBe(true,);
        expect(resumed.prepared.blockPairing,).toEqual(first.prepared.blockPairing,);
      },
    },),
    it({
      name: 'RECONTESTS CONTESTED PAIRING instead of replaying settlement failure, then caches recovered split',
      fn: async () => {
        /**
         * Cache shared by contested and recovered attempts.
         */
        const stored = new Map<string, PairedSectionRecord>();
        /**
         * Original blocks shared by both attempts.
         */
        const sourceText = '猫睡在盒子里。\n\n它整个下午都没有动。';
        /**
         * Translation blocks shared by both attempts.
         */
        const targetText = 'The cat slept in the box.\n\nShe stayed still.\n\nAll afternoon.';
        /**
         * Cache boundary proving first attempt leaves nothing terminal.
         */
        const pairingCache = memoryPairingCache({ stored, },);
        await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":2}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":2}]}',
            ],
          },),
          modelIds: [
            ...ROSTER,
            'hf:openai/gpt-oss-120b',
            'hf:moonshotai/Kimi-K3',
          ],
          sourceText,
          targetText,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
          pairingCache,
        },);
        expect(stored.size,).toBe(0,);

        /**
         * Recovered attempt whose roster corroborates one-to-many split.
         */
        const recovered = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":1,"target":2}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":1,"target":2}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText,
          targetText,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
          pairingCache,
        },);

        expect(recovered.prepared.blockPairing?.at(0,)?.pairs,).toEqual([
          { source: 0, target: 0, },
          { source: 1, target: 1, },
          { source: 1, target: 2, },
        ],);
        expect(recovered.prepared.unclaimedTargetBlocks,).toEqual([]);
        expect(stored.size,).toBe(1,);
      },
    },),
    it({
      name: 'DOES NOT CACHE PAIRING THAT LEAVES ARCHIVE BLOCK UNCLAIMED, allowing next bounded attempt to seek safer correspondence',
      fn: async () => {
        const stored = new Map<string, PairedSectionRecord>();
        await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0}]}',
              '{"pairs":[{"source":0,"target":0}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText: '猫睡着了。',
          targetText: 'The cat slept.\n\nAn archive-only aside.',
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
          pairingCache: memoryPairingCache({ stored, },),
        },);

        expect(stored.size,).toBe(0,);
      },
    },),
    it({
      name:
        'RECORDS HOW MANY VOICES AGREED, naming the section, and files it on the channel that reaches the '
        + 'artifact rather than only on the log nobody keeps',
      fn: async () => {
        const {
          prepared,
          findings,
        } = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);

        /**
         * What the counts have to say, section and all.
         */
        const expected = 'block-pairing section 0 paired 2 of 2 original and 2 of 2 translation blocks '
          + 'across 2 relations, from 2 usable voices of 2 heard';
        expect(findings,).toContain(expected,);

        // THE ARTIFACT READS THE PREPARATION, not this return value, and
        // `assertFindingsDescribePreparation` refuses a build where the two
        // disagree. So the finding is worth nothing unless it is on both.
        expect(prepared.alignmentFindings,).toContain(expected,);
      },
    },),
    it({
      name:
        'RECORDS AN EMPTY PAIRING when the roster was asked and agreed nothing, which is a different fact '
        + 'from no roster having been asked and must not read as the same absence',
      fn: async () => {
        const {
          prepared,
          findings,
        } = await prepareDocumentPairWithRoster({
          client: cannedClient({ replyByModel: ['{"pairs":[]}',], },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(prepared.blockPairing,).toEqual([],);
        expect(findings,).toContain('block-pairing section 0 fell back to scoring',);

        // NO COUNT LINE WHERE NOTHING WAS AGREED would be the wrong reading:
        // the voices were heard and usable, they simply named nothing, and that
        // is exactly the case the counts are worth recording for.
        expect(findings,).toContain(
          'block-pairing section 0 paired 0 of 2 original and 0 of 2 translation blocks across 0 relations, from 2 usable voices of 2 heard',
        );
      },
    },),

    it({
      name:
        'REPUBLISHES EVERY FINDING OFF A CACHED SECTION, having asked nobody. The cache stored a bare '
        + 'list of pairs until 2026-08-22, so a resumed entry reported a silent round: no per-section '
        + 'counts, no fallback notice, no voice-level finding. The two runs are compared whole rather '
        + 'than by sampled string, because a replay that keeps some findings and drops others is the '
        + 'shape this defect actually had',
      fn: async () => {
        /**
         * Records surviving between the two runs, as a resumed pass finds them.
         */
        const stored = new Map<string, PairedSectionRecord>();

        const cold = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          pairingCache: memoryPairingCache({ stored, },),
          l,
        },);

        // POSITIVE CONTROL. Two empty lists compare equal, so a replay that lost
        // everything would satisfy the comparison below against a run that said
        // nothing. The cold run has to have reported something first.
        expect(cold.findings.length > 0,).toBe(true,);
        expect(stored.size,).toBe(1,);

        /**
         * Calls the resumed run made, which must stay at none.
         */
        let calls = 0;

        const warm = await prepareDocumentPairWithRoster({
          client: createSyntheticClient({
            apiKey: 'test-key',
            transport: async function countingTransport() {
              calls += 1;
              throw new Error('the resumed run bought a pairing it already had',);
            },
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          pairingCache: memoryPairingCache({ stored, },),
          l,
        },);

        expect(calls,).toBe(0,);
        expect(warm.findings,).toEqual(cold.findings,);
        expect(warm.prepared.blockPairing,).toEqual(cold.prepared.blockPairing,);
      },
    },),
  ],
},);
