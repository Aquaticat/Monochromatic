/**
 * Tests for the provider router: which provider takes a call, what happens
 * when one refuses, and what a picture narrows.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  type BudgetView,
  createRoutingClient,
  EveryProviderDryError,
  isJsonRecord,
  NoProviderForModelError,
  type ProviderName,
  type ProviderRecord,
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
 * How long the slow first-provider stub holds its slot: long enough for a
 * concurrent caller to find it busy, short enough not to slow the suite.
 */
const SLOT_HOLD_MS = 50;

/**
 * Production Synthetic slots measured per active model.
 */
const EXPECTED_SYNTHETIC_SLOTS = 5;

/**
 * One Synthetic slot per model, no ceiling elsewhere.
 */
const ONE_SYNTHETIC_SLOT = {
  synthetic: 1,
  hyper: Number.POSITIVE_INFINITY,
  openrouter: Number.POSITIVE_INFINITY,
};

/**
 * A value per provider, each one optional because a case names only the
 * providers it scripts.
 */
type PerProvider<ValueT,> = {
  readonly synthetic?: ValueT;
  readonly hyper?: ValueT;
  readonly openrouter?: ValueT;
};

/**
 * Builds stub providers recording which took each call.
 *
 * @param status - status each provider refuses with, zero to answer
 *
 * @param refusals - how many calls each provider refuses before answering,
 * every call by default when it has a refusing status
 *
 * @param text - what each provider answers when it answers
 *
 * @returns Every provider's caller plus the log of who was called
 *
 * @example
 * ```ts
 * const { callers, called, } = stubProviders({},);
 * ```
 */
function stubProviders(
  {
    status = {},
    refusals = {},
    text = {},
  }: {
    readonly status?: PerProvider<number>;
    readonly refusals?: PerProvider<number>;
    readonly text?: PerProvider<string>;
  },
) {
  /**
   * Providers asked, in call order.
   */
  const called: ProviderName[] = [];

  /**
   * Answers each provider gives, distinguishable by default.
   */
  const answers: ProviderRecord<string> = {
    synthetic: text.synthetic ?? '{"spot":"windowsill"}',
    hyper: text.hyper ?? '{"spot":"radiator"}',
    openrouter: text.openrouter ?? '{"spot":"laundry basket"}',
  };

  /**
   * How many more calls each provider refuses before answering.
   */
  const refusalsLeft: Record<ProviderName, number> = {
    synthetic: refusals.synthetic ?? (((status.synthetic ?? 0) === 0) ? 0 : Number.POSITIVE_INFINITY),
    hyper: refusals.hyper ?? (((status.hyper ?? 0) === 0) ? 0 : Number.POSITIVE_INFINITY),
    openrouter: refusals.openrouter ?? (((status.openrouter ?? 0) === 0) ? 0 : Number.POSITIVE_INFINITY),
  };

  /**
   * Builds one provider's caller.
   *
   * @param provider - provider this caller stands for
   *
   * @returns Caller that records itself, refuses as told, then answers
   */
  function callerFor(provider: ProviderName,) {
    return {
      chatText: async function chatText() {
        called.push(provider,);
        if (refusalsLeft[provider] > 0) {
          refusalsLeft[provider] -= 1;
          throw new SyntheticHttpError({
            status: status[provider] ?? 0,
            bodyText: 'refused',
          },);
        }
        return { text: answers[provider], };
      },
    };
  }

  return {
    called,
    callers: {
      synthetic: callerFor('synthetic',),
      hyper: callerFor('hyper',),
      openrouter: callerFor('openrouter',),
    },
  };
}

/**
 * Builds a budget view that answers as told and records refusals.
 *
 * @param dry - which providers read as out of budget
 *
 * @param holdsMs - what the holds report
 *
 * @param onHoldEnd - what a read after the holds were asked for does first
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
    dry = {},
    holdsMs = {
      synthetic: 0,
      hyper: 0,
      openrouter: 0,
    },
    onHoldEnd,
  }: {
    readonly dry?: PerProvider<boolean>;
    readonly holdsMs?: ProviderRecord<number>;
    readonly onHoldEnd?: () => void;
  },
) {
  /**
   * Providers that reported themselves out of budget, in order.
   */
  const refused: ProviderName[] = [];

  /**
   * View as the meters read it, which a refusal then overrides.
   */
  const view: Record<ProviderName, boolean> = {
    synthetic: dry.synthetic ?? false,
    hyper: dry.hyper ?? false,
    openrouter: dry.openrouter ?? false,
  };

  /**
   * How many times the holds were asked for.
   */
  const holdReads = { count: 0, };

  return {
    refused,
    holdReads,
    view,
    budgets: {
      read: async function read(): Promise<BudgetView> {
        // A read after the holds were asked for is a read after the router
        // waited, so the stub lets the test flip the view the way an expired
        // hold would.
        if (holdReads.count > 0)
          onHoldEnd?.();
        return { ...view, };
      },
      markRefused: async function markRefused({ provider, }: { readonly provider: ProviderName; },): Promise<void> {
        refused.push(provider,);
        view[provider] = true;
      },
      holds: function holds(): ProviderRecord<number> {
        holdReads.count += 1;
        return { ...holdsMs, };
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

/**
 * Routes one text call for Kimi-K3 and reports what happened.
 *
 * @param client - router under test
 *
 * @param modelId - model to ask
 *
 * @returns Reply text, or the error thrown
 *
 * @example
 * ```ts
 * const outcome = await ask({ client, },);
 * ```
 */
async function ask(
  {
    client,
    modelId = 'hf:moonshotai/Kimi-K3',
  }: {
    readonly client: ReturnType<typeof createRoutingClient>;
    readonly modelId?: Parameters<ReturnType<typeof createRoutingClient>['chatText']>[0]['modelId'];
  },
): Promise<{ readonly text: string; } | { readonly thrown: unknown; }> {
  try {
    return { text: (await client.chatText({
      modelId,
      messages: MESSAGES,
      signal: SIGNAL,
    },)).text, };
  } catch (error) {
    return { thrown: error, };
  }
}

await describe({
  name: createRoutingClient.name,
  children: [
    it({
      name: 'prefers the first provider while it has budget and a free slot',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        expect(await ask({ client, },),).toEqual({ text: '{"spot":"windowsill"}', },);
        expect(called,).toEqual(['synthetic',],);
      },
    },),

    it({
      name: 'sends a model Synthetic does not serve to Hyper, the next provider that does',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        await ask({
          client,
          modelId: 'deepseek-v4-flash-0731',
        },);
        expect(called,).toEqual(['hyper',],);
      },
    },),

    it({
      name: 'moves every call to the second provider when the first is dry',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({ dry: { synthetic: true, }, },);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        await ask({ client, },);
        expect(called,).toEqual(['hyper',],);
      },
    },),

    it({
      name: 'MOVES EVERY CALL TO OPENROUTER when Synthetic and Hyper are both dry, the owner\'s '
        + 'fallback of 2026-09-03, including a model Synthetic never served',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({
          dry: {
            synthetic: true,
            hyper: true,
          },
        },);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        expect(await ask({ client, },),).toEqual({ text: '{"spot":"laundry basket"}', },);
        await ask({
          client,
          modelId: 'deepseek-v4-flash-0731',
        },);
        expect(called,).toEqual(['openrouter', 'openrouter',],);
      },
    },),

    it({
      name: 'FORWARDS a refused call to the next provider instead of losing it',
      fn: async () => {
        const { callers, called, } = stubProviders({ status: { synthetic: 429, }, },);
        const { budgets, refused, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        // THE WHOLE REASON `#199` EXISTS: a pass exhausted one provider's
        // weekly credit and 866 of 875 lost voices carried this one status.
        // Retrying the exhausted provider never succeeds, and refusing to
        // settle turns a budget problem into holes in the deliverable.
        expect(await ask({ client, },),).toEqual({ text: '{"spot":"radiator"}', },);
        expect(called,).toEqual(['synthetic', 'hyper',],);
        expect(refused,).toEqual(['synthetic',],);
      },
    },),

    it({
      name: 'FORWARDS TWICE when the first two providers refuse in turn, reaching the third, and '
        + 'ends on the third refusal rather than looping',
      fn: async () => {
        const { callers, called, } = stubProviders({
          status: {
            synthetic: 429,
            hyper: 402,
          },
        },);
        const { budgets, refused, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        expect(await ask({ client, },),).toEqual({ text: '{"spot":"laundry basket"}', },);
        expect(called,).toEqual(['synthetic', 'hyper', 'openrouter',],);
        expect(refused,).toEqual(['synthetic', 'hyper',],);

        const everyone = stubProviders({
          status: {
            synthetic: 429,
            hyper: 429,
            openrouter: 402,
          },
        },);
        const all = createRoutingClient({
          callers: everyone.callers,
          budgets: stubBudgets({},).budgets,
        },);
        const outcome = await ask({ client: all, },);
        expect(('thrown' in outcome) && (outcome.thrown instanceof SyntheticHttpError),).toBe(true,);
        expect(everyone.called,).toEqual(['synthetic', 'hyper', 'openrouter',],);
      },
    },),

    it({
      name: 'FORWARDS a payment refusal, which is how a balance provider says it, and ends the run '
        + 'when it was the last provider with budget',
      fn: async () => {
        const { callers, called, } = stubProviders({ status: { openrouter: 402, }, },);
        const { budgets, refused, } = stubBudgets({
          dry: {
            synthetic: true,
            hyper: true,
          },
        },);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        const outcome = await ask({ client, },);
        // A subscription reports exhaustion as a rate limit and a balance
        // reports it as payment due; both mark the provider.
        expect(refused,).toEqual(['openrouter',],);
        expect(called,).toEqual(['openrouter',],);
        expect(('thrown' in outcome) && (outcome.thrown instanceof EveryProviderDryError),).toBe(true,);
      },
    },),

    it({
      name: 'WAITS OUT THE SHORTEST HOLD when every provider is held out by refusals, then routes '
        + 'to the one that came back, instead of ending the run: the pin pass of 2026-09-02 (#474) '
        + 'failed every remaining entry inside one second on two holds while both meters read wet',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const stub = stubBudgets({
          dry: {
            synthetic: true,
            hyper: true,
            openrouter: true,
          },
          holdsMs: {
            synthetic: 5,
            hyper: 20,
            openrouter: 20,
          },
          onHoldEnd: function syntheticComesBack(): void {
            stub.view.synthetic = false;
          },
        },);
        const client = createRoutingClient({
          callers,
          budgets: stub.budgets,
          holdPollMs: 1,
        },);

        expect(await ask({ client, },),).toEqual({ text: '{"spot":"windowsill"}', },);
        expect(called,).toEqual(['synthetic',],);
        expect(stub.holdReads.count,).toBe(1,);
      },
    },),

    it({
      name: 'GOES BACK TO THE REFUSER once its hold has been waited out when the other providers are '
        + 'dry by meter: the refusal that routed the call is what the hold became, and a hold that '
        + 'expired is the provider coming back, not a second reason to call it dry',
      fn: async () => {
        const { callers, called, } = stubProviders({
          status: { synthetic: 429, },
          refusals: { synthetic: 1, },
        },);
        const stub = stubBudgets({
          dry: {
            hyper: true,
            openrouter: true,
          },
          holdsMs: {
            synthetic: 5,
            hyper: 0,
            openrouter: 0,
          },
          onHoldEnd: function syntheticComesBack(): void {
            stub.view.synthetic = false;
          },
        },);
        const client = createRoutingClient({
          callers,
          budgets: stub.budgets,
          holdPollMs: 1,
        },);

        expect(await ask({ client, },),).toEqual({ text: '{"spot":"windowsill"}', },);
        expect(called,).toEqual(['synthetic', 'synthetic',],);
        expect(stub.refused,).toEqual(['synthetic',],);
        expect(stub.holdReads.count,).toBe(1,);
      },
    },),

    it({
      name: 'ENDS THE RUN when every provider reads dry with no hold to wait out, since nothing a '
        + 'wait could change is left',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, holdReads, } = stubBudgets({
          dry: {
            synthetic: true,
            hyper: true,
            openrouter: true,
          },
        },);
        const client = createRoutingClient({
          callers,
          budgets,
          holdPollMs: 1,
        },);

        const outcome = await ask({ client, },);
        expect(('thrown' in outcome) && (outcome.thrown instanceof EveryProviderDryError),).toBe(true,);
        expect(called,).toEqual([],);
        expect(holdReads.count,).toBe(1,);
      },
    },),

    it({
      name: 'REFUSES to re-route a failure that is not about budget',
      fn: async () => {
        const { callers, called, } = stubProviders({ status: { synthetic: 500, }, },);
        const { budgets, refused, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        const outcome = await ask({ client, },);
        // Spending another provider's budget on a fault that is not about
        // budget would hide the fault and pay for it twice.
        expect(('thrown' in outcome) && (outcome.thrown instanceof SyntheticHttpError),).toBe(true,);
        expect(called,).toEqual(['synthetic',],);
        expect(refused,).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES a model whose only providers are out of budget while another is wet',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({
          dry: {
            hyper: true,
            openrouter: true,
          },
        },);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        const outcome = await ask({
          client,
          modelId: 'deepseek-v4-flash-0731',
        },);
        // Synthetic does not serve this model, so the budgets of the two that
        // do ARE the model's.
        expect(('thrown' in outcome) && (outcome.thrown instanceof NoProviderForModelError),).toBe(true,);
        expect(called,).toEqual([],);
      },
    },),

    it({
      name: 'sends GLM-5.3-Flash pictures and text through the first provider that reads them',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        await client.chatText({
          modelId: 'hf:zai-org/GLM-5.3-Flash',
          messages: PICTURE_MESSAGES,
          signal: SIGNAL,
        },);
        expect(called,).toEqual(['synthetic',],);

        await client.chatText({
          modelId: 'hf:zai-org/GLM-5.3-Flash',
          messages: MESSAGES,
          signal: SIGNAL,
        },);
        expect(called,).toEqual(['synthetic', 'synthetic',],);
      },
    },),

    it({
      name: 'KEEPS a picture off a provider that does not read it for this model, which is why '
        + 'vision reach is asked per provider: gpt-oss reads nowhere and gemma reads nowhere yet',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        /**
         * What a picture to a model no provider shows pictures to produces.
         */
        let thrown: unknown;
        try {
          await client.chatText({
            modelId: 'hf:openai/gpt-oss-120b',
            messages: PICTURE_MESSAGES,
            signal: SIGNAL,
          },);
        } catch (error) {
          thrown = error;
        }
        expect(thrown instanceof NoProviderForModelError,).toBe(true,);
        expect(called,).toEqual([],);
      },
    },),

    it({
      name: 'overflows to the second provider while the first one is saturated',
      fn: async () => {
        const { callers, called, } = stubProviders({},);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
          slotLimits: ONE_SYNTHETIC_SLOT,
        },);

        await Promise.all([
          ask({ client, },),
          ask({ client, },),
        ],);

        // The second call finds the one slot busy and goes elsewhere rather
        // than queueing behind it.
        expect(called.toSorted(),).toEqual(['hyper', 'synthetic',],);
      },
    },),

    it({
      name: 'uses five Synthetic slots before default routing overflows to Hyper',
      fn: async () => {
        /** Providers asked, in call order. */
        const called: ProviderName[] = [];
        /** First provider holding every admitted slot. */
        const synthetic = {
          chatText: async function chatText() {
            called.push('synthetic',);
            await wait(SLOT_HOLD_MS,);
            return { text: '{"spot":"windowsill"}', };
          },
        };
        /** Overflow provider answering without a local concurrency ceiling. */
        const hyper = {
          chatText: async function chatText() {
            called.push('hyper',);
            return { text: '{"spot":"windowsill"}', };
          },
        };
        /** Third provider, never reached while Hyper is wet. */
        const openrouter = {
          chatText: async function chatText() {
            called.push('openrouter',);
            return { text: '{"spot":"windowsill"}', };
          },
        };
        const { budgets, } = stubBudgets({},);
        /** Router using production default slot count. */
        const client = createRoutingClient({
          callers: {
            synthetic,
            hyper,
            openrouter,
          },
          budgets,
        },);
        /** One more concurrent call than Synthetic has measured slots. */
        const calls = Array.from(
          { length: EXPECTED_SYNTHETIC_SLOTS + 1, },
          function callModel() {
            return ask({ client, },);
          },
        );

        await Promise.all(calls,);

        expect(called.filter(function syntheticCall(provider,) {
          return provider === 'synthetic';
        },),).toHaveLength(EXPECTED_SYNTHETIC_SLOTS,);
        expect(called.filter(function hyperCall(provider,) {
          return provider === 'hyper';
        },),).toHaveLength(1,);
      },
    },),

    it({
      name: 'FORWARDS a non-conformant answer to the same model on the next stack',
      fn: async () => {
        const { callers, called, } = stubProviders({ text: { synthetic: 'I will not do that.', }, },);
        const { budgets, refused, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);
        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        // The providers extract structure by different mechanisms, a forced
        // tool on one and a response format on the others, so the same
        // weights can conform on one stack and not another.
        expect(called,).toEqual(['synthetic', 'hyper',],);
        expect(outcome.kind,).toBe('ok',);
        // A bad ANSWER is not a budget refusal; nothing is marked.
        expect(refused,).toEqual([],);
      },
    },),

    it({
      name: 'RE-ASKS ON OPENROUTER when Hyper is dry, since the next wet provider serving the model '
        + 'is the second opinion, wherever it sits in the order',
      fn: async () => {
        const { callers, called, } = stubProviders({ text: { synthetic: 'I will not do that.', }, },);
        const { budgets, } = stubBudgets({ dry: { hyper: true, }, },);
        const client = createRoutingClient({
          callers,
          budgets,
        },);
        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        expect(called,).toEqual(['synthetic', 'openrouter',],);
        expect(outcome.kind,).toBe('ok',);
      },
    },),

    it({
      name: 'PAIRS the re-ask\'s slot release with a take, so the Synthetic count does not drift '
        + 'negative and overflow to Hyper keeps working afterwards (`#240`)',
      fn: async () => {
        /**
         * Providers asked, in call order.
         */
        const called: ProviderName[] = [];
        /**
         * First provider, holding its one slot long enough for a concurrent
         * caller to find it busy.
         */
        const synthetic = {
          chatText: async function chatText() {
            called.push('synthetic',);
            await wait(SLOT_HOLD_MS,);
            return { text: '{"spot":"windowsill"}', };
          },
        };
        /**
         * Second provider, answering at once and unparseably, so the caller
         * re-asks the first.
         */
        const hyper = {
          chatText: async function chatText() {
            called.push('hyper',);
            return { text: 'I will not do that.', };
          },
        };
        /** Third provider, dry throughout. */
        const openrouter = {
          chatText: async function chatText() {
            called.push('openrouter',);
            return { text: '{"spot":"windowsill"}', };
          },
        };
        const { budgets, } = stubBudgets({ dry: { openrouter: true, }, },);
        /** Router under test, one Synthetic slot per model. */
        const client = createRoutingClient({
          callers: {
            synthetic,
            hyper,
            openrouter,
          },
          budgets,
          slotLimits: ONE_SYNTHETIC_SLOT,
        },);

        // Phase one: the first call holds the slot, the second finds it busy,
        // goes to Hyper, gets nothing usable, and re-asks Synthetic. Before the
        // fix that re-ask released a slot nothing had taken.
        await Promise.all([
          client.chatJson({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
            validate: isNapSpot,
          },),
          client.chatJson({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: MESSAGES,
            signal: SIGNAL,
            validate: isNapSpot,
          },),
        ],);
        expect(called,).toEqual(['synthetic', 'hyper', 'synthetic',],);
        called.splice(0,);

        // Phase two: with every slot handed back, one concurrent call takes
        // the slot and the other overflows. A count that had drifted to minus
        // one would show both a free slot and put both on Synthetic.
        await Promise.all([
          ask({ client, },),
          ask({ client, },),
        ],);
        expect(called.toSorted(),).toEqual(['hyper', 'synthetic',],);
      },
    },),

    it({
      name: 'REFUSES to re-ask when no other provider serving the model has budget',
      fn: async () => {
        const { callers, called, } = stubProviders({ text: { hyper: 'I will not do that.', }, },);
        const { budgets, } = stubBudgets({ dry: { openrouter: true, }, },);
        const client = createRoutingClient({
          callers,
          budgets,
        },);
        const outcome = await client.chatJson({
          // Synthetic never served this model and OpenRouter is dry, so the
          // answer falls to `#88`'s invalid-candidate path.
          modelId: 'glm-5.3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        expect(called,).toEqual(['hyper',],);
        expect(outcome.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'KEEPS the first answer and starts the next provider\'s cooldown when the re-ask is refused on '
        + 'budget, instead of raising out of an exchange that already has an answer',
      fn: async () => {
        const { callers, called, } = stubProviders({
          text: { synthetic: 'I will not do that.', },
          status: { hyper: 429, },
        },);
        const { budgets, refused, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);

        const outcome = await client.chatJson({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: SIGNAL,
          validate: isNapSpot,
        },);

        expect(outcome.kind,).not.toBe('ok',);
        expect(called,).toEqual(['synthetic', 'hyper',],);
        expect(refused,).toEqual(['hyper',],);
      },
    },),

    it({
      name: 'keeps the preferred provider\'s answer when the re-ask fails too',
      fn: async () => {
        const { callers, called, } = stubProviders({
          text: {
            synthetic: 'first refusal',
            hyper: 'second refusal',
          },
        },);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);
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
      name: 'reads a routed answer through the same ladder every provider uses',
      fn: async () => {
        const { callers, } = stubProviders({ status: { synthetic: 429, }, },);
        const { budgets, } = stubBudgets({},);
        const client = createRoutingClient({
          callers,
          budgets,
        },);
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
