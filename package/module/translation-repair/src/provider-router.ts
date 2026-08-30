import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type ModelReach,
  routeProviderFor,
} from './budget-routing.ts';
import {
  carriesPicture,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChatTextReply,
  type ChatTextRequest,
  type ModelCaller,
  type SyntheticClient,
} from './chat-contract.ts';
import { readJsonOutcome, } from './chat-json-outcome.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import type { HyperClient, } from './hyper-client.ts';
import type {
  ProviderBudgets,
  ProviderName,
} from './provider-budget.ts';
import type { RosterModelId, } from './roster-id.ts';
import { SYNTHETIC_PER_MODEL_CONCURRENCY, } from './synthetic-client.ts';
import {
  reachOf,
  visionReachOf,
} from './roster-reach.ts';

//region Provider router
// ONE CLIENT OVER TWO PROVIDERS. A stage names a panelist; this decides where
// to buy the call, and a stage never learns which provider served it.
//
// THE POLICY IS THE OWNER'S, and `budget-routing.ts` holds the arithmetic: the
// first provider is preferred while it has budget and a free slot, the second
// absorbs the overflow, and either one being dry moves everything to the other.
// Nothing here re-decides that; this file supplies the three facts the policy
// reads and performs whatever it returns.
//
// A REFUSED CALL IS RE-ROUTED, NOT LOST. That is the whole reason `#199` was
// opened: a pass exhausted one provider's weekly credit and 866 of 875 lost
// voices carried a single HTTP 429. Retrying an exhausted provider never
// succeeds and refusing to settle turns a budget problem into holes in the
// deliverable, so a budget refusal marks that provider and asks the other.
//
// IT DELEGATES ONLY `chatText`. The schema ladder is provider-neutral and
// already lives in `chat-json-outcome.ts`, so a routed `chatJson` reads the
// text this file fetched rather than calling a provider's own. That keeps one
// ladder for both providers and makes the parameters narrow enough to state:
// each is `Pick<..., 'chatText'>` and nothing more.
//
// RE-ROUTED EXACTLY ONCE. A second failure is the answer, not an invitation to
// keep going: with two providers the only remaining destination is the one that
// just refused us, and `routeProviderFor` raises rather than return it.

/**
 * How a subscription reports that its allowance is spent.
 */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * How a credit balance reports that it has nothing left.
 */
const HTTP_PAYMENT_REQUIRED = 402;

/**
 * Statuses that mean a provider is out of budget rather than unwell.
 *
 * BOTH, BECAUSE THE TWO PROVIDERS SAY IT DIFFERENTLY. A subscription reports
 * exhaustion as a rate limit, and a credit balance reports it as payment due.
 * A retry ladder already rides 429 as transient; arriving here means the ladder
 * gave up, which is what distinguishes a burst from an empty account.
 */
const BUDGET_REFUSAL_STATUSES: ReadonlySet<number> = new Set([
  HTTP_TOO_MANY_REQUESTS,
  HTTP_PAYMENT_REQUIRED,
],);

/**
 * Logger root for the routing layer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Refusal raised when no provider can take one call at all.
 *
 * @example
 * ```ts
 * throw new NoProviderForModelError({ modelId, reason: 'no provider serves this model', },);
 * ```
 */
export class NoProviderForModelError extends Error {
  /**
   * Declares this message safe to forward: it names a model and which of two routing outcomes it hit.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds failure naming the model and why nowhere could take it.
   *
   * @param modelId - model the call was addressed to
   *
   * @param reason - what the router decided, verbatim
   *
   * @example
   * ```ts
   * new NoProviderForModelError({ modelId: 'minimax-m3', reason: 'no provider serves this model', },);
   * ```
   */
  public constructor(
    {
      modelId,
      reason,
    }: {
      readonly modelId: string;
      readonly reason: string;
    },
  ) {
    super(`no provider can take ${modelId}: ${reason}`,);
    this.name = 'NoProviderForModelError';
  }
}

/**
 * Providers that can serve one call, narrowed to vision where it carries a
 * picture.
 *
 * @param request - call whose reach is read
 *
 * @returns Reach for the policy, or for a re-ask, to decide on
 *
 * @example
 * ```ts
 * const reach = reachFor({ request, },);
 * ```
 */
function reachFor(
  { request, }: { readonly request: ForeignBorrowed<ChatTextRequest>; },
): ModelReach {
  if (carriesPicture({ messages: request.messages, },))
    return visionReachOf({ modelId: request.modelId, },);
  return reachOf({ modelId: request.modelId, },);
}

/**
 * One answer plus the provider that produced it.
 *
 * THE PROVIDER TRAVELS WITH THE REPLY because the schema re-ask needs to know
 * where NOT to ask again, and nothing in the reply itself records it.
 *
 * @example
 * ```ts
 * const answered: RoutedReply = { provider: 'hyper', reply, };
 * ```
 */
type RoutedReply = {
  /**
   * Provider that served this call.
   */
  readonly provider: ProviderName;

  /**
   * What it answered.
   */
  readonly reply: ChatTextReply;
};

/**
 * Whether a thrown failure says the provider is out of budget.
 *
 * @param error - whatever the call threw
 *
 * @returns Whether the other provider should be asked instead
 *
 * @example
 * ```ts
 * if (isBudgetRefusal({ error, },)) budgets.markRefused({ provider, },);
 * ```
 */
function isBudgetRefusal(
  { error, }: { readonly error: unknown; },
): boolean {
  if (!(error instanceof SyntheticHttpError))
    return false;
  return BUDGET_REFUSAL_STATUSES.has(error.status,);
}

/**
 * What a re-ask came back with.
 *
 * A NAMED REFUSAL RATHER THAN AN ABSENT REPLY, because the two are different
 * facts: the provider was asked and said no on budget, which the caller keeps
 * the first answer over, as opposed to never having been asked.
 *
 * @example
 * ```ts
 * const asked: ReAskReply = { kind: 'budget-refused', };
 * ```
 */
type ReAskReply = {
  /**
   * Provider answered.
   */
  readonly kind: 'replied';

  /**
   * What it said.
   */
  readonly reply: ChatTextReply;
} | {
  /**
   * Provider refused on budget, and its cooldown has started.
   */
  readonly kind: 'budget-refused';
};

/**
 * Builds the client that routes each call to whichever provider can serve it.
 *
 * @param synthetic - first provider's text call, which is all this delegates
 *
 * @param hyper - second provider's text call, which is all this delegates
 *
 * @param budgets - shared budget view both are routed by
 *
 * @param syntheticSlotsPerModel - concurrent calls the first provider's client
 * grants one model, which decides when it counts as saturated; must match the
 * `perModelConcurrency` that client was built with
 *
 * @returns Client surface a stage calls without naming a provider
 *
 * @example
 * ```ts
 * const client = createRoutingClient({ synthetic, hyper, budgets, },);
 * ```
 */
export function createRoutingClient(
  {
    synthetic,
    hyper,
    budgets,
    syntheticSlotsPerModel = SYNTHETIC_PER_MODEL_CONCURRENCY,
  }: {
    readonly synthetic: Pick<SyntheticClient, 'chatText'>;
    readonly hyper: Pick<HyperClient, 'chatText'>;
    readonly budgets: ProviderBudgets;
    readonly syntheticSlotsPerModel?: number;
  },
): ModelCaller {
  /**
   * Calls in flight on the first provider, per model.
   *
   * COUNTED HERE RATHER THAN ASKED OF THE CLIENT, because saturation is what
   * the routing policy calls the state of every slot being busy, and the client
   * that owns those slots does not expose their occupancy. This layer is the
   * one that dispatches, so it is the one that knows.
   */
  const inFlightOnSynthetic = new Map<RosterModelId, number>();

  /**
   * Adjusts the in-flight count for one model.
   *
   * @param modelId - model whose count moves
   *
   * @param by - change to apply
   *
   * @example
   * ```ts
   * countInFlight({ modelId, by: 1, },);
   * ```
   */
  function countInFlight(
    {
      modelId,
      by,
    }: {
      readonly modelId: RosterModelId;
      readonly by: number;
    },
  ): void {
    inFlightOnSynthetic.set(
      modelId,
      (inFlightOnSynthetic.get(modelId,) ?? 0) + by,
    );
  }

  /**
   * Decides which provider takes one call, given what is known right now.
   *
   * @param request - call being routed, read for its model and its pictures
   *
   * @param syntheticDown - whether the first provider has just refused us
   *
   * @returns Provider to ask
   *
   * @throws {@link NoProviderForModelError} when nowhere can take it
   *
   * @throws {@link import('./budget-routing.ts').BothProvidersDryError} when both are out of budget
   *
   * @example
   * ```ts
   * const provider = await chooseProvider({ request, syntheticDown: false, },);
   * ```
   */
  async function chooseProvider(
    {
      request,
      syntheticDown,
    }: {
      readonly request: ForeignBorrowed<ChatTextRequest>;
      readonly syntheticDown: boolean;
    },
  ): Promise<ProviderName> {
    /**
     * Providers that can serve this model, narrowed where it carries a picture.
     */
    const reach = reachFor({ request, },);

    /**
     * What each provider's budget looks like right now.
     */
    const {
      syntheticDry,
      hyperDry,
    } = await budgets.read({ signal: request.signal, },);

    /**
     * Where the owner's policy sends this call.
     */
    const choice = routeProviderFor({
      reach,
      syntheticDry: syntheticDry || syntheticDown,
      hyperDry,
      syntheticSaturated: (inFlightOnSynthetic.get(request.modelId,) ?? 0) >= syntheticSlotsPerModel,
    },);

    if (choice.kind === 'unreachable')
      throw new NoProviderForModelError({
        modelId: request.modelId,
        reason: choice.reason,
      },);

    // THE SLOT IS TAKEN HERE, NOT AT DISPATCH, and there must be no `await`
    // between reading the count above and this line. Two calls choosing at
    // once both resume from the budget read before either has been sent, so a
    // count that only rose at dispatch showed both of them a free slot and put
    // both on the same provider. Counting at the decision closes that, because
    // nothing else runs between the read and the increment.
    if (choice.kind === 'synthetic')
      countInFlight({
        modelId: request.modelId,
        by: 1,
      },);
    return choice.kind;
  }

  /**
   * Hands back the slot {@link chooseProvider} took, whatever the call did.
   *
   * A DISPOSABLE RATHER THAN A `finally`, so the release cannot be skipped by
   * an early return added later and does not need the caller to remember it.
   *
   * @param modelId - model whose slot is released on scope exit
   *
   * @returns Handle to bind with `using`
   *
   * @example
   * ```ts
   * using slot = heldSlot({ modelId, },);
   * ```
   */
  function heldSlot(
    { modelId, }: { readonly modelId: RosterModelId; },
  ): Disposable {
    return {
      [Symbol.dispose]: function release(): void {
        countInFlight({
          modelId,
          by: -1,
        },);
      },
    };
  }

  /**
   * Performs one call on the named provider, releasing its slot afterwards.
   *
   * @param provider - provider to ask, as {@link chooseProvider} decided
   *
   * @param request - call to perform
   *
   * @mutates request - the delegated client serializes messages and response format; see its contract
   *
   * @returns Whatever that provider answered
   *
   * @example
   * ```ts
   * const reply = await callOn({ provider: 'hyper', request, },);
   * ```
   */
  async function callOn(
    {
      provider,
      request,
    }: {
      readonly provider: ProviderName;
      readonly request: ForeignBorrowed<ChatTextRequest>;
    },
  ): Promise<ChatTextReply> {
    if (provider === 'hyper')
      return await hyper.chatText(request,);

    // PAIRED WITH THE INCREMENT IN `chooseProvider` AND IN THE RE-ASK: every
    // decision of `synthetic` takes one slot and reaches exactly one call here.
    /**
     * Slot this call holds until it returns or raises.
     */
    using slot = heldSlot({ modelId: request.modelId, },);

    // Named so the handle is bound rather than discarded; `using` is what
    // makes it do its work, and reading it here keeps that legible.
    void slot;
    return await synthetic.chatText(request,);
  }

  /**
   * Calls one provider, and reads a budget refusal as no reply rather than as
   * a fault.
   *
   * THE RE-ASK IS OPPORTUNISTIC, so a 429 or a 402 on it is the re-ask not
   * happening, not the exchange failing: the first answer is what the caller
   * gets, the way it does when there is nowhere else to ask. The refusal still
   * starts that provider's cooldown on the call it arrived on, rather than one
   * call later when the next routing decision meets it.
   *
   * @param provider - stack to ask
   *
   * @param request - exchange to perform
   *
   * @returns Reply, or the named refusal when the provider was out of budget
   *
   * @example
   * ```ts
   * const asked = await replyOrBudgetRefusal({ provider: 'synthetic', request, },);
   * ```
   */
  async function replyOrBudgetRefusal(
    {
      provider,
      request,
    }: {
      readonly provider: ProviderName;
      readonly request: ForeignBorrowed<ChatTextRequest>;
    },
  ): Promise<ReAskReply> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: replyOrBudgetRefusal.name,
      l,
    },);

    try {
      return {
        kind: 'replied',
        reply: await callOn({
          provider,
          request,
        },),
      };
    } catch (error) {
      if (!isBudgetRefusal({ error, },))
        throw error;

      budgets.markRefused({ provider, },);
      rl.warn(`${request.modelId}: ${provider} is out of budget on the re-ask; keeping the first answer`,);
      return { kind: 'budget-refused', };
    }
  }

  /**
   * Free-text chat exchange, routed and re-routed once on a budget refusal.
   *
   * @param request - exchange to perform
   *
   * @mutates request - the delegated client serializes messages and response format; see its contract
   *
   * @returns Content text and usage when reported
   *
   * @throws {@link NoProviderForModelError} when nowhere can take it
   *
   * @example
   * ```ts
   * const reply = await client.chatText({ modelId, messages, signal, },);
   * ```
   */
  async function routedText(
    request: ForeignBorrowed<ChatTextRequest>,
  ): Promise<RoutedReply> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: routedText.name,
      l,
    },);

    /**
     * Provider the policy picked on what was known before the call.
     */
    const first = await chooseProvider({
      request,
      syntheticDown: false,
    },);

    try {
      return {
        provider: first,
        reply: await callOn({
          provider: first,
          request,
        },),
      };
    } catch (error) {
      if (!isBudgetRefusal({ error, },))
        throw error;

      budgets.markRefused({ provider: first, },);
      rl.warn(`${request.modelId}: ${first} is out of budget, asking the other provider`,);

      /**
       * Provider left once the refusing one is held out, which raises rather
       * than hand back the one that just refused us.
       */
      const second = await chooseProvider({
        request,
        syntheticDown: first === 'synthetic',
      },);

      return {
        provider: second,
        reply: await callOn({
          provider: second,
          request,
        },),
      };
    }
  }

  /**
   * Free-text chat exchange, routed and re-routed once on a budget refusal.
   *
   * @param request - exchange to perform
   *
   * @mutates request - the delegated client serializes messages and response format; see its contract
   *
   * @returns Content text and usage when reported
   *
   * @throws {@link NoProviderForModelError} when nowhere can take it
   *
   * @example
   * ```ts
   * const reply = await client.chatText({ modelId, messages, signal, },);
   * ```
   */
  async function chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
    return (await routedText(request,)).reply;
  }

  /**
   * The other provider, where it can also serve this call and has budget.
   *
   * @param request - call that was answered badly
   *
   * @param served - provider that answered it
   *
   * @returns Provider to re-ask, absent where there is nowhere else to ask
   *
   * @example
   * ```ts
   * const elsewhere = await secondOpinionFrom({ request, served: 'synthetic', },);
   * ```
   */
  async function secondOpinionFrom(
    {
      request,
      served,
    }: {
      readonly request: ForeignBorrowed<ChatTextRequest>;
      readonly served: ProviderName;
    },
  ): Promise<readonly ProviderName[]> {
    /**
     * Provider that did not answer this call.
     */
    const other: ProviderName = (served === 'synthetic') ? 'hyper' : 'synthetic';

    /**
     * Whether it serves this model at all, pictures included.
     */
    const reach = reachFor({ request, },);

    if (!((other === 'hyper') ? reach.onHyper : reach.onSynthetic))
      return [];

    /**
     * What each provider's budget looks like right now.
     */
    const budget = await budgets.read({ signal: request.signal, },);

    if ((other === 'hyper') ? budget.hyperDry : budget.syntheticDry)
      return [];
    return [other,];
  }

  /**
   * Schema-validated chat exchange over whichever provider served the text.
   *
   * @param request - exchange plus content guard
   *
   * @mutates request - the delegated client serializes messages and response format; see its contract
   *
   * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
   *
   * @example
   * ```ts
   * const outcome = await client.chatJson({ modelId, messages, signal, validate: isVerdict, },);
   * ```
   */
  async function chatJson<ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ): Promise<ChatJsonOutcome<ValueT>> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatJson.name,
      l,
    },);

    /**
     * Raw text reply of the routed exchange, and who answered it.
     */
    const {
      provider,
      reply,
    } = await routedText(request,);

    /**
     * What that answer turned out to be.
     */
    const outcome = readJsonOutcome({
      modelId: request.modelId,
      reply,
      validate: request.validate,
    },);

    if (outcome.kind === 'ok')
      return outcome;

    /**
     * Somewhere else to ask, where this model is served and has budget.
     */
    const [elsewhere,] = await secondOpinionFrom({
      request,
      served: provider,
    },);

    if (elsewhere === undefined)
      return outcome;

    rl.info(
      `${request.modelId}: ${outcome.kind} on ${provider}, asking ${elsewhere} for the same model`,
    );

    // THE SLOT IS TAKEN HERE FOR THE SAME REASON `chooseProvider` takes it at
    // the decision: `callOn` releases one slot on every Synthetic call, and a
    // re-ask that reached Synthetic without a take released a slot nothing
    // held, so the count drifted negative and overflow to Hyper needed that
    // many extra concurrent calls before it resumed (`#240`). No `await` sits
    // between the budget read in `secondOpinionFrom` and this line.
    if (elsewhere === 'synthetic')
      countInFlight({
        modelId: request.modelId,
        by: 1,
      },);

    /**
     * Same model, same question, the other serving stack; or nothing, when that
     * stack refused on budget.
     */
    const asked = await replyOrBudgetRefusal({
      provider: elsewhere,
      request,
    },);

    if (asked.kind === 'budget-refused')
      return outcome;

    /**
     * What the other stack's answer turned out to be.
     */
    const second = readJsonOutcome({
      modelId: request.modelId,
      reply: asked.reply,
      validate: request.validate,
    },);

    if (second.kind === 'ok')
      return second;

    // THE FIRST ANSWER IS RETURNED WHEN BOTH FAIL, because it came from the
    // provider the policy preferred and the caller's own handling is written
    // against that. Both are logged, so a reader can see the re-ask happened
    // and did not help.
    rl.info(`${request.modelId}: ${elsewhere} answered ${second.kind} too`,);
    return outcome;
  }

  return {
    chatText,
    chatJson,
  };
}

//endregion Provider router
