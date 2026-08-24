/**
 * Tests for the two-provider router: which provider takes a call, what happens
 * when one refuses, and what a picture narrows.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  BothProvidersDryError,
  type BudgetView,
  type ProviderName,
  createRoutingClient,
  isJsonRecord,
  NoProviderForModelError,
  SyntheticHttpError,
} from '../dist/final/node/index.mjs';

/**
 * Plain text conversation reused across routed calls.
 */
const MESSAGES = [
  {
    role: 'user' as const,
    content: '这只猫睡在哪里？',
  },
];

/**
 * Conversation carrying a picture, which narrows where it can go.
 */
const PICTURE_MESSAGES = [
  {
    role: 'user' as const,
    content: [
      { type: 'text' as const, text: 'Read this picture.', },
      { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,AAAA', }, },
    ],
  },
];

/**
 * Abort signal every routed call in these tests carries.
 */
const SIGNAL = new AbortController().signal;

/**
 * Builds a pair of stub providers recording which took each call.
 *
 * @param syntheticStatus - status the first provider refuses with, zero to answer
 *
 * @param hyperStatus - status the second provider refuses with, zero to answer
 *
 * @param syntheticText - what the first provider answers when it answers
 *
 * @param hyperText - what the second provider answers when it answers
 *
 * @returns Both providers plus the log of who was called
 *
 * @example
 * ```ts
 * const { synthetic, hyper, called, } = stubProviders({},);
 * ```
 */
function stubProviders(
  {
    syntheticStatus = 0,
    hyperStatus = 0,
    syntheticText = '{"spot":"windowsill"}',
    hyperText = '{"spot":"radiator"}',
  }: {
    readonly syntheticStatus?: number;
    readonly hyperStatus?: number;
    readonly syntheticText?: string;
    readonly hyperText?: string;
  },
) {
  /**
   * Providers asked, in call order.
   */
  const called: string[] = [];

  return {
    called,
    synthetic: {
      chatText: async function chatText() {
        called.push('synthetic',);
        if (syntheticStatus !== 0)
          throw new SyntheticHttpError({
            status: syntheticStatus,
            bodyText: 'refused',
          },);
        return { text: syntheticText, };
      },
    },
    hyper: {
      chatText: async function chatText() {
        called.push('hyper',);
        if (hyperStatus !== 0)
          throw new SyntheticHttpError({
            status: hyperStatus,
            bodyText: 'refused',
          },);
        return { text: hyperText, };
      },
    },
  };
}

/**
 * Builds a budget view that answers as told and records refusals.
 *
 * @param syntheticDry - whether the first provider reads as out of budget
 *
 * @param hyperDry - whether the second provider reads as out of budget
 *
 * @returns Budget view plus the providers marked as having refused us
 *
 * @example
 * ```ts
 * const { budgets, refused, } = stubBudgets({},);
 * ```
 */
function stubBudgets(
  {
    syntheticDry = false,
    hyperDry = false,
  }: {
    readonly syntheticDry?: boolean;
    readonly hyperDry?: boolean;
  },
) {
  /**
   * Providers that reported themselves out of budget, in order.
   */
  const refused: string[] = [];

  /**
   * View as the meters read it, which a refusal then overrides.
   */
  const view: { syntheticDry: boolean; hyperDry: boolean; } = {
    syntheticDry,
    hyperDry,
  };

  return {
    refused,
    budgets: {
      read: async function read(): Promise<BudgetView> {
        return { ...view, };
      },
      markRefused: function markRefused({ provider, }: { readonly provider: ProviderName; },): void {
        refused.push(provider,);
        if (provider === 'synthetic')
          view.syntheticDry = true;
        else
          view.hyperDry = true;
      },
    },
  };
}

/**
 * Guards a routed JSON answer.
 *
 * @param value - parsed candidate
 *
 * @returns Whether value carries a string spot
 *
 * @example
 * ```ts
 * isNapSpot({ spot: 'windowsill', },);
 * ```
 */
function isNapSpot(value: unknown,): value is { readonly spot: string; } {
  return isJsonRecord(value,) && ((typeof value.spot) === 'string');
}

await describe({
  name: createRoutingClient.name,
  children: [
    it({
      name: 'prefers the first provider while it has budget and a free slot',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with money on both sides. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);

        expect((await client.chatText({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
        },)).text,).toBe('{"spot":"windowsill"}',);
        expect(called,).toEqual(['synthetic',],);
      },
    },),

    it({
      name: 'sends a model only the second provider serves straight there',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with money on both sides. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);

        await client.chatText({
          modelId: 'deepseek-v4-flash-0731',
          messages: MESSAGES,
          signal: SIGNAL,
        },);
        expect(called,).toEqual(['hyper',],);
      },
    },),

    it({
      name: 'moves every call to the second provider when the first is dry',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with the first provider spent. */
        const { budgets, } = stubBudgets({ syntheticDry: true, },);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);

        await client.chatText({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
        },);
        expect(called,).toEqual(['hyper',],);
      },
    },),

    it({
      name: 'FORWARDS a refused call to the other provider instead of losing it',
      fn: async () => {
        /** Stub providers with the first one out of credit. */
        const { synthetic, hyper, called, } = stubProviders({ syntheticStatus: 429, },);
        /** Budget view whose meters both still report money. */
        const { budgets, refused, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);

        // THE WHOLE REASON `#199` EXISTS: a pass exhausted one provider's
        // weekly credit and 866 of 875 lost voices carried this one status.
        // Retrying the exhausted provider never succeeds, and refusing to
        // settle turns a budget problem into holes in the deliverable.
        expect((await client.chatText({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
        },)).text,).toBe('{"spot":"radiator"}',);
        expect(called,).toEqual(['synthetic', 'hyper',],);
        expect(refused,).toEqual(['synthetic',],);
      },
    },),

    it({
      name: 'FORWARDS a payment refusal, which is how the other provider says it',
      fn: async () => {
        /** Stub providers with the second one out of balance. */
        const { synthetic, hyper, called, } = stubProviders({ hyperStatus: 402, },);
        /** Budget view with the first provider spent, so routing starts there. */
        const { budgets, refused, } = stubBudgets({ syntheticDry: true, },);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Failure both-dry produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
          },);
        } catch (error) {
          caught = error;
        }

        // A subscription reports exhaustion as a rate limit and a balance
        // reports it as payment due; both mark the provider.
        expect(refused,).toEqual(['hyper',],);
        expect(called,).toEqual(['hyper',],);
        expect(caught instanceof BothProvidersDryError,).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES to re-route a failure that is not about budget',
      fn: async () => {
        /** Stub providers with the first one unwell rather than broke. */
        const { synthetic, hyper, called, } = stubProviders({ syntheticStatus: 500, },);
        /** Budget view with money on both sides. */
        const { budgets, refused, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Failure the unwell provider produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
          },);
        } catch (error) {
          caught = error;
        }

        // Spending a second provider's budget on a fault that is not about
        // budget would hide the fault and pay for it twice.
        expect(caught instanceof SyntheticHttpError,).toBe(true,);
        expect(called,).toEqual(['synthetic',],);
        expect(refused,).toEqual([],);
      },
    },),

    it({
      name: 're-routes exactly once, so a second refusal is the answer',
      fn: async () => {
        /** Stub providers, both out of credit. */
        const { synthetic, hyper, called, } = stubProviders({
          syntheticStatus: 429,
          hyperStatus: 429,
        },);
        /** Budget view whose meters both still report money. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Failure the second refusal produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
          },);
        } catch (error) {
          caught = error;
        }

        expect(called,).toEqual(['synthetic', 'hyper',],);
        expect(caught instanceof SyntheticHttpError,).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a call when both providers are out of budget',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with nothing left anywhere. */
        const { budgets, } = stubBudgets({
          syntheticDry: true,
          hyperDry: true,
        },);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Failure the dry pair produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
          },);
        } catch (error) {
          caught = error;
        }

        expect(caught instanceof BothProvidersDryError,).toBe(true,);
        expect(called,).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES a model whose only provider is out of budget',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with the second provider spent. */
        const { budgets, } = stubBudgets({ hyperDry: true, },);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Failure the unreachable model produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'deepseek-v4-flash-0731',
            messages: MESSAGES,
            signal: SIGNAL,
          },);
        } catch (error) {
          caught = error;
        }

        // Only one provider serves this model, so its budget IS the model's.
        expect(caught instanceof NoProviderForModelError,).toBe(true,);
        expect(called,).toEqual([],);
      },
    },),

    it({
      name: 'sends a picture only where that model can actually read one',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with money on both sides. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);

        // READING IS NARROWER THAN TALKING. Both providers serve this model's
        // text and only the second reports vision for it, so a picture has
        // exactly one place to go even though the plain call prefers the first.
        await client.chatText({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: PICTURE_MESSAGES,
          signal: SIGNAL,
        },);
        expect(called,).toEqual(['hyper',],);

        await client.chatText({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: SIGNAL,
        },);
        expect(called,).toEqual(['hyper', 'synthetic',],);
      },
    },),

    it({
      name: 'overflows to the second provider while the first one is saturated',
      fn: async () => {
        /** Stub providers, both answering. */
        const { synthetic, hyper, called, } = stubProviders({},);
        /** Budget view with money on both sides. */
        const { budgets, } = stubBudgets({},);
        /** Router under test, told the first provider grants one slot. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
          syntheticSlotsPerModel: 1,
        },);

        await Promise.all([
          client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
          },),
          client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
          },),
        ],);

        // The second call finds the one slot busy and goes elsewhere rather
        // than queueing behind it.
        expect(called.toSorted(),).toEqual(['hyper', 'synthetic',],);
      },
    },),

    it({
      name: 'FORWARDS a non-conformant answer to the same model on the other stack',
      fn: async () => {
        /** Providers, both answering, the first one unparseably. */
        const { synthetic, hyper, called, } = stubProviders({ syntheticText: 'I will not do that.', },);
        /** Budget view with money on both sides. */
        const { budgets, refused, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Outcome after the re-ask. */
        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        // The two providers extract structure by different mechanisms, a
        // forced tool on one and a response format on the other, so the same
        // weights can conform on one stack and not the other.
        expect(called,).toEqual(['synthetic', 'hyper',],);
        expect(outcome.kind,).toBe('ok',);
        // A bad ANSWER is not a budget refusal; nothing is marked.
        expect(refused,).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES to re-ask a model the other provider does not serve',
      fn: async () => {
        /** Providers, the first answering unparseably. */
        const { synthetic, hyper, called, } = stubProviders({ syntheticText: 'I will not do that.', },);
        /** Budget view with money on both sides. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Outcome with nowhere else to ask. */
        const outcome = await client.chatJson({
          modelId: 'hf:Qwen/Qwen3.8-27B',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        // This model has one provider, so the answer falls to `#88`'s
        // invalid-candidate path rather than to a second stack.
        expect(called,).toEqual(['synthetic',],);
        expect(outcome.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'REFUSES to re-ask when the other provider has no budget left',
      fn: async () => {
        /** Providers, the first answering unparseably. */
        const { synthetic, hyper, called, } = stubProviders({ syntheticText: 'I will not do that.', },);
        /** Budget view with the second provider spent. */
        const { budgets, } = stubBudgets({ hyperDry: true, },);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Outcome with nowhere affordable to ask. */
        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        expect(called,).toEqual(['synthetic',],);
        expect(outcome.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'keeps the preferred provider\'s answer when the re-ask fails too',
      fn: async () => {
        /** Providers, both answering unparseably and distinguishably. */
        const { synthetic, hyper, called, } = stubProviders({
          syntheticText: 'first refusal',
          hyperText: 'second refusal',
        },);
        /** Budget view with money on both sides. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Outcome after both stacks disagreed with the schema. */
        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        expect(called,).toEqual(['synthetic', 'hyper',],);
        // The preferred provider's answer is the one the caller's own handling
        // is written against.
        expect(outcome.rawText,).toBe('first refusal',);
      },
    },),

    it({
      name: 'reads a routed answer through the same ladder either provider uses',
      fn: async () => {
        /** Stub providers with the first one out of credit. */
        const { synthetic, hyper, } = stubProviders({ syntheticStatus: 429, },);
        /** Budget view whose meters both still report money. */
        const { budgets, } = stubBudgets({},);
        /** Router under test. */
        const client = createRoutingClient({
          synthetic,
          hyper,
          budgets,
        },);
        /** Outcome of one routed schema-validated call. */
        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        expect(outcome.kind,).toBe('ok',);
        expect(
          outcome.kind === 'ok' ? outcome.value : undefined,
        ).toEqual({ spot: 'radiator', },);
      },
    },),
  ],
},);
