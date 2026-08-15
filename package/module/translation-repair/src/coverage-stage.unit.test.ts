/**
 * Tests for the stage that asks a roster whether a translation carries a
 * passage, driven by a scripted client so nothing is bought.
 *
 * What these pin is the WIRING rather than the arithmetic, which
 * `coverage-verdict.unit.test.ts` covers: that the stage takes its threshold
 * from the roster it asked rather than from the replies it got, and that a
 * roster too quiet to decide produces no decision.
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
  parseDocument,
  runCoverageStage,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger the stage writes its progress to.
 */
const l = tagged({ tag: 'coverage-stage-test', },);

/**
 * Translation the roster is asked about.
 */
const TARGET_TEXT = `The cat sleeps on the windowsill each morning and naps on its cushion at noon.

She watches the birds outside.
`;

/**
 * That translation, parsed once.
 */
const TARGET = parseDocument({ text: TARGET_TEXT, },);

/**
 * Roster the questions go to.
 */
const ROSTER = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-C',
  'hf:cat/Cat-D',
].map(function toModelId(id,): SyntheticModelId {
  return id as unknown as SyntheticModelId;
},);

/**
 * What each model is scripted to answer, or nothing to make it go silent.
 */
type CoverageScript = Record<string, {
  readonly coverage: string;
  readonly quote: string;
}>;

/**
 * Builds a client answering from a script and never reaching a network.
 *
 * @param script - reply per model, absent for a model that stays silent
 *
 * @returns Client the stage can be driven with
 *
 * @example
 * ```ts
 * const client = scriptedClient({ script, },);
 * ```
 */
function scriptedClient({ script, }: { readonly script: CoverageScript; },): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the coverage stage',);
    },
    quotas: async () => {
      throw new Error('quotas unused by the coverage stage',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Reply this model was scripted to give, absent when it stays silent.
       */
      const scripted = script[request.modelId];
      if (scripted === undefined) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted silence',
        };
      }

      /**
       * Wire value carrying it.
       */
      const value: unknown = {
        coverage: scripted.coverage,
        quote: scripted.quote,
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

await describe({
  name: runCoverageStage.name,
  children: [
    it({
      name: 'takes its threshold from the ROSTER it asked, so two models reporting nothing while two '
        + 'stay silent is not a decision: half a roster is not a majority of it',
      fn: async () => {
        const answer = await runCoverageStage({
          client: scriptedClient({
            script: {
              'hf:cat/Cat-A': {
                coverage: 'none',
                quote: '',
              },
              'hf:cat/Cat-B': {
                coverage: 'none',
                quote: '',
              },
            },
          },),
          modelIds: ROSTER,
          sourcePassage: '小猫中午在垫子上打盹。',
          translation: TARGET,
          signal: AbortSignal.timeout(30_000,),
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(answer.verdict
          .asked,).toBe(4,);
        expect(answer.verdict
          .heard,).toBe(2,);
        expect(answer.verdict
          .absent,).toBe(2,);
        expect(answer.verdict
          .kind,).toBe('split',);
      },
    },),
    it({
      name: 'reports CARRIED when a majority of the roster anchors the same English, which is what a '
        + 'passage merged into a neighbouring sentence looks like from here',
      fn: async () => {
        const answer = await runCoverageStage({
          client: scriptedClient({
            script: {
              'hf:cat/Cat-A': {
                coverage: 'full',
                quote: 'naps on its cushion at noon',
              },
              'hf:cat/Cat-B': {
                coverage: 'full',
                quote: 'naps on its cushion at noon',
              },
              'hf:cat/Cat-C': {
                coverage: 'full',
                quote: 'naps on its cushion at noon',
              },
              'hf:cat/Cat-D': {
                coverage: 'none',
                quote: '',
              },
            },
          },),
          modelIds: ROSTER,
          sourcePassage: '小猫中午在垫子上打盹。',
          translation: TARGET,
          signal: AbortSignal.timeout(30_000,),
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(answer.verdict
          .kind,).toBe('carried',);
        expect(answer.verdict
          .anchoredFull,).toBe(3,);
      },
    },),
  ],
},);
