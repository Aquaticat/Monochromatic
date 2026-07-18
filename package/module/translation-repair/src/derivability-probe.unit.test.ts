/**
 * Tests for the derivability probe wire and ensemble stage.
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

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { runDerivabilityProbe, } from './derivability-probe.ts';
import {
  isDerivabilityVerdict,
  resolveDerivabilityJudgment,
} from './derivability-wire.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'derivability-probe-test', },);

/**
 * References for a two-seed entry.
 */
const REFERENCES = [
  {
    seedId: 'seed/omission-0',
    deletedText: 'The cat also chases crimson butterflies across the meadow at dawn.',
  },
  {
    seedId: 'seed/omission-1',
    deletedText: 'The bowl by the stove stays full through the night.',
  },
] as const;

/**
 * Client scripted per model with a fixed verdict list; a model in the
 * silent set loses its voice so quorum paths can be exercised.
 *
 * @param verdictsByModel - verdicts each model casts, seed order
 *
 * @param silent - models whose calls fail
 */
function probingClient(
  {
    verdictsByModel,
    silent = new Set<string>(),
  }: {
    readonly verdictsByModel: Readonly<Record<string, readonly string[]>>;
    readonly silent?: ReadonlySet<string>;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      if (silent.has(request.modelId,)) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted silence',
        };
      }

      /**
       * Verdicts this model casts, defaulting to all derivable.
       */
      const verdicts = verdictsByModel[request.modelId] ?? ['derivable', 'derivable',];

      /**
       * Scripted wire report over the candidate numbering.
       */
      const scripted: unknown = {
        judgments: verdicts.map(function toJudgment(verdict, index,) {
          return {
            reference: index + 1,
            verdict,
          };
        },),
      };
      if (!request.validate(scripted,))
        throw new Error('scripted payload failed the guard',);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 * Three-judge roster for the stage tests.
 */
const JUDGES: readonly SyntheticModelId[] = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.6-27B',
  'hf:moonshotai/Kimi-K2.7-Code',
];

await describe({
  name: isDerivabilityVerdict.name,
  children: [
    it({
      name: 'accepts the closed vocabulary and rejects everything else',
      fn: async () => {
        expect(isDerivabilityVerdict('derivable',),).toBe(true,);
        expect(isDerivabilityVerdict('partially-derivable',),).toBe(true,);
        expect(isDerivabilityVerdict('not-derivable',),).toBe(true,);
        expect(isDerivabilityVerdict('restored',),).toBe(false,);
        expect(isDerivabilityVerdict(1,),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: resolveDerivabilityJudgment.name,
  children: [
    it({
      name: 'resolves through the index map and records irregularities',
      fn: async () => {
        /** Report with one good, one out-of-range, one unknown verdict. */
        const resolution = resolveDerivabilityJudgment({
          wire: {
            judgments: [
              { reference: 1, verdict: 'derivable', },
              { reference: 9, verdict: 'derivable', },
              { reference: 2, verdict: 'restored', },
            ],
          },
          seedIds: ['seed/omission-0', 'seed/omission-1',],
        },);
        expect(resolution.verdicts['seed/omission-0'],).toBe('derivable',);
        expect(resolution.verdicts['seed/omission-1'],).toBe(undefined,);
        expect(resolution.findings,).toContain('derivability-reference-out-of-range (9)',);
        expect(resolution.findings,).toContain('unknown-derivability-verdict (restored)',);
        expect(resolution.findings,).toContain('missing-derivability-judgment (2)',);
      },
    },),
  ],
},);

await describe({
  name: runDerivabilityProbe.name,
  children: [
    it({
      name: 'takes the upper median across judges',
      fn: async () => {
        /** Split judgments: derivable/partially/not on seed 0, all derivable on seed 1. */
        const derivability = await runDerivabilityProbe({
          client: probingClient({
            verdictsByModel: {
              'hf:zai-org/GLM-5.2': ['derivable', 'derivable',],
              'hf:Qwen/Qwen3.6-27B': ['partially-derivable', 'derivable',],
              'hf:moonshotai/Kimi-K2.7-Code': ['not-derivable', 'derivable',],
            },
          },),
          judgeModelIds: JUDGES,
          sourceText: '猫猫黎明追蝴蝶。碗是满的。',
          references: REFERENCES,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        // Odd count: the median of not<partially<derivable is partially-derivable.
        expect(derivability['seed/omission-0']?.verdict,).toBe('partially-derivable',);
        expect(derivability['seed/omission-0']?.judged,).toBe(true,);
        expect(derivability['seed/omission-1']?.verdict,).toBe('derivable',);
      },
    },),

    it({
      name: 'rounds an even split toward the more-derivable verdict',
      fn: async () => {
        /** Two judges heard, one derivable one not-derivable, on seed 0. */
        const derivability = await runDerivabilityProbe({
          client: probingClient({
            verdictsByModel: {
              'hf:zai-org/GLM-5.2': ['derivable', 'derivable',],
              'hf:Qwen/Qwen3.6-27B': ['not-derivable', 'derivable',],
            },
            silent: new Set(['hf:moonshotai/Kimi-K2.7-Code',],),
          },),
          judgeModelIds: JUDGES,
          sourceText: '猫猫黎明追蝴蝶。碗是满的。',
          references: REFERENCES,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        // Upper median of [not-derivable, derivable] is derivable: the
        // excuse, not the pipeline, carries the burden of proof.
        expect(derivability['seed/omission-0']?.judged,).toBe(true,);
        expect(derivability['seed/omission-0']?.verdict,).toBe('derivable',);
      },
    },),

    it({
      name: 'marks seeds unjudged and unexcused when quorum is lost',
      fn: async () => {
        /** Only one of three judges answers: quorum unmet. */
        const derivability = await runDerivabilityProbe({
          client: probingClient({
            verdictsByModel: { 'hf:zai-org/GLM-5.2': ['not-derivable', 'not-derivable',], },
            silent: new Set(['hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K2.7-Code',],),
          },),
          judgeModelIds: JUDGES,
          sourceText: '猫猫黎明追蝴蝶。碗是满的。',
          references: REFERENCES,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        // Unjudged defaults to derivable so a lost probe never excuses.
        expect(derivability['seed/omission-0']?.judged,).toBe(false,);
        expect(derivability['seed/omission-0']?.verdict,).toBe('derivable',);
      },
    },),

    it({
      name: 'returns nothing for an entry with no references',
      fn: async () => {
        /** Empty reference set short-circuits before any call. */
        const derivability = await runDerivabilityProbe({
          client: probingClient({ verdictsByModel: {}, },),
          judgeModelIds: JUDGES,
          sourceText: '猫',
          references: [],
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(Object.keys(derivability,),).toHaveLength(0,);
      },
    },),
  ],
},);
