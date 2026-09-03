import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  HOLD_POLL_MS,
  NOBODY_REFUSED,
  readBudgetsPastHolds,
} from './budget-hold-wait.ts';
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
} from './chat-contract.ts';
import { isBudgetRefusal, } from './provider-budget-refusal.ts';
import type { ProviderBudgets, } from './provider-budget.ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
  type ProviderRecord,
} from './provider-name.ts';
import {
  type RoutedCore,
  routedJson,
} from './provider-router-reask.ts';
import type { RoutedReply, } from './provider-router-reply.ts';
import {
  createSlotLedger,
  type SlotLimits,
} from './provider-router-slots.ts';
import { SYNTHETIC_PER_MODEL_CONCURRENCY, } from './synthetic-client.ts';
import {
  reachOf,
  visionReachOf,
} from './roster-reach.ts';

//region Provider router
// ONE CLIENT OVER EVERY PROVIDER. A stage names a panelist; this decides where
// to buy the call, and a stage never learns which provider served it.
//
// THE POLICY IS THE OWNER'S, and `budget-routing.ts` holds the arithmetic: the
// providers are walked in `PROVIDER_ORDER`, the first with budget and a free
// slot takes the call, and a dry provider passes the call down the order.
// Nothing here re-decides that; this file supplies the facts the policy reads
// and performs whatever it returns.
//
// A REFUSED CALL IS RE-ROUTED, NOT LOST. That is the whole reason `#199` was
// opened: a pass exhausted one provider's weekly credit and 866 of 875 lost
// voices carried a single HTTP 429. Retrying an exhausted provider never
// succeeds and refusing to settle turns a budget problem into holes in the
// deliverable, so a budget refusal marks that provider and asks the next.
//
// IT DELEGATES ONLY `chatText`. The schema ladder is provider-neutral and
// already lives in `chat-json-outcome.ts`, so a routed `chatJson` reads the
// text this file fetched rather than calling a provider's own. That keeps one
// ladder for every provider and makes the parameters narrow enough to state:
// each caller is `Pick<..., 'chatText'>` and nothing more.
//
// RE-ROUTED AT MOST ONCE PER PROVIDER. Each refusal marks its provider and
// asks the budgets again through `readBudgetsPastHolds`, which waits out a
// refusal hold before calling every provider dry, so a refuser can come back
// for a later re-route once its hold has ended (the #474 shape); an all-dry
// reading no hold explains raises, and the call ends there. The loop is
// bounded by the number of providers, so a wall of refusals is an answer
// rather than an invitation to keep going.

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
   * Declares this message safe to forward: it names a model and which of the routing outcomes it hit.
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
 * Per-model slots the providers grant by default: Synthetic's measured five,
 * nothing on the providers that state no ceiling.
 */
const DEFAULT_SLOT_LIMITS: SlotLimits = { synthetic: SYNTHETIC_PER_MODEL_CONCURRENCY, };

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
 * Builds the client that routes each call to whichever provider can serve it.
 *
 * @param callers - each provider's text call, which is all this delegates
 *
 * @param budgets - shared budget view every call is routed by
 *
 * @param slotLimits - concurrent calls each limiting provider's client grants
 * one model, which decides when it counts as saturated; must match the
 * `perModelConcurrency` that client was built with
 *
 * @param holdPollMs - how often a call waiting out a hold checks for abort;
 * injectable so a test waits milliseconds rather than a second
 *
 * @returns Client surface a stage calls without naming a provider
 *
 * @example
 * ```ts
 * const client = createRoutingClient({ callers: { synthetic, hyper, openrouter, }, budgets, },);
 * ```
 */
export function createRoutingClient(
  {
    callers,
    budgets,
    slotLimits = DEFAULT_SLOT_LIMITS,
    holdPollMs = HOLD_POLL_MS,
  }: {
    readonly callers: ProviderRecord<Pick<ModelCaller, 'chatText'>>;
    readonly budgets: ProviderBudgets;
    readonly slotLimits?: SlotLimits;
    readonly holdPollMs?: number;
  },
): ModelCaller {
  /**
   * In-flight slots on the providers that limit them.
   */
  const ledger = createSlotLedger({ limits: slotLimits, },);

  /**
   * Decides which provider takes one call, given what is known right now.
   *
   * @param request - call being routed, read for its model and its pictures
   *
   * @param refused - provider that has just refused us, or nobody
   *
   * @returns Provider to ask
   *
   * @throws {@link NoProviderForModelError} when nowhere can take it
   *
   * @throws {@link import('./budget-routing.ts').EveryProviderDryError} when
   * every provider is out of budget with no refusal hold left to wait out
   *
   * @example
   * ```ts
   * const provider = await chooseProvider({ request, refused: NOBODY_REFUSED, },);
   * ```
   */
  async function chooseProvider(
    {
      request,
      refused,
    }: {
      readonly request: ForeignBorrowed<ChatTextRequest>;
      readonly refused: ProviderName | typeof NOBODY_REFUSED;
    },
  ): Promise<ProviderName> {
    /**
     * Providers that can serve this model, narrowed where it carries a picture.
     */
    const reach = reachFor({ request, },);

    /**
     * What each provider's budget looks like right now, the refusal that
     * routed here folded in and any hold every provider was under waited out.
     */
    const dry = await readBudgetsPastHolds({
      budgets,
      modelId: request.modelId,
      signal: request.signal,
      refused,
      pollMs: holdPollMs,
    },);

    /**
     * Where the owner's policy sends this call.
     */
    const choice = routeProviderFor({
      reach,
      dry,
      saturated: ledger.saturated({ modelId: request.modelId, },),
    },);

    if (choice.kind === 'unreachable')
      throw new NoProviderForModelError({
        modelId: request.modelId,
        reason: choice.reason,
      },);

    // THE SLOT IS TAKEN HERE, NOT AT DISPATCH, and there must be no `await`
    // between reading the ledger above and this line. Two calls choosing at
    // once both resume from the budget read before either has been sent, so a
    // count that only rose at dispatch showed both of them a free slot and put
    // both on the same provider. Counting at the decision closes that, because
    // nothing else runs between the read and the increment.
    ledger.take({
      provider: choice.kind,
      modelId: request.modelId,
    },);
    return choice.kind;
  }

  /**
   * Performs one call on the named provider, releasing its slot afterwards.
   *
   * PAIRED WITH THE TAKE IN `chooseProvider` AND IN THE RE-ASK: every decision
   * takes one slot on a limiting provider and reaches exactly one call here.
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
    /**
     * Slot this call holds until it returns or raises; a no-op on a provider
     * that grants no limit.
     */
    using slot = ledger.held({
      provider,
      modelId: request.modelId,
    },);

    // Named so the handle is bound rather than discarded; `using` is what
    // makes it do its work, and reading it here keeps that legible.
    void slot;
    return await callers[provider].chatText(request,);
  }

  /**
   * Free-text chat exchange, routed and re-routed on budget refusals, at most
   * once per provider.
   *
   * @param request - exchange to perform
   *
   * @mutates request - the delegated client serializes messages and response format; see its contract
   *
   * @returns Content text and usage when reported, and who answered
   *
   * @throws {@link NoProviderForModelError} when nowhere can take it
   *
   * @example
   * ```ts
   * const { provider, reply, } = await routedText({ modelId, messages, signal, },);
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
     * Provider that refused the previous attempt, folded into the next
     * decision; nobody before the first.
     */
    let refused: ProviderName | typeof NOBODY_REFUSED = NOBODY_REFUSED;

    // ONE ATTEMPT PER PROVIDER AT MOST. The loop cannot be a `map`: each
    // decision depends on the refusal before it, and the last refusal is the
    // answer.
    for (const attempt of PROVIDER_ORDER.keys()) {
      /**
       * Provider the policy picked on what is known before this attempt.
       */
      // eslint-disable-next-line no-await-in-loop -- each choice depends on the refusal before it
      const provider = await chooseProvider({
        request,
        refused,
      },);

      try {
        return {
          provider,
          // eslint-disable-next-line no-await-in-loop -- the call IS the attempt
          reply: await callOn({
            provider,
            request,
          },),
        };
      } catch (error) {
        if (!isBudgetRefusal({ error, },))
          throw error;

        // eslint-disable-next-line no-await-in-loop -- the hold must start before the next decision reads the budgets
        await budgets.markRefused({
          provider,
          signal: request.signal,
        },);
        if (attempt === (PROVIDER_ORDER.length - 1))
          throw error;
        rl.warn(`${request.modelId}: ${provider} refused us, asking the next provider`,);
        refused = provider;
      }
    }

    // Unreachable: the loop returns a reply or rethrows the last refusal.
    throw new NoProviderForModelError({
      modelId: request.modelId,
      reason: 'every provider refused this call',
    },);
  }

  /**
   * Free-text chat exchange, routed and re-routed on budget refusals.
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
   * What the re-ask borrows from this router.
   */
  const core: RoutedCore = {
    reachFor,
    budgets,
    ledger,
    callOn,
    routedText,
  };

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
    return await routedJson({
      core,
      request,
    },);
  }

  return {
    chatText,
    chatJson,
  };
}

//endregion Provider router
