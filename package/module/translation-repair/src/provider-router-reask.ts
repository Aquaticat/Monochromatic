import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ModelReach, } from './budget-routing.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
} from './chat-contract.ts';
import { readJsonOutcome, } from './chat-json-outcome.ts';
import { isBudgetRefusal, } from './provider-budget-refusal.ts';
import type { ProviderBudgets, } from './provider-budget.ts';
import {
  otherProviders,
  type ProviderName,
} from './provider-name.ts';
import type {
  ReAskReply,
  RoutedReply,
} from './provider-router-reply.ts';
import type { SlotLedger, } from './provider-router-slots.ts';

//region Provider router re-ask
// A NON-CONFORMANT ANSWER IS RE-ASKED ON ANOTHER PROVIDER THAT SERVES THE MODEL.
//
// Why this is worth a second call rather than a retry: the providers extract
// structure by genuinely different mechanisms, a forced tool on one and a
// `response_format` on the others, so the same weights can conform on one
// serving stack and not on another.
//
// IT IS NOT A BUDGET FAILOVER and does not pretend to be one. A bad answer
// marks nobody as refusing. The re-ask is skipped where no other provider
// serves the model, which is the `#88` invalid-candidate path the policy
// names, and skipped where every other provider is dry. When the second stack
// disagrees with the schema too, the FIRST provider's answer is returned,
// because the caller's own handling is written against it; both are logged.
//
// SPLIT FROM `provider-router.ts` at its line budget. The router lends it the
// three things it needs: the reach of a request, the budget view, and the
// dispatch that performs one call on one provider.

/**
 * Logger root for the re-ask.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * What the router lends the re-ask.
 *
 * @example
 * ```ts
 * const core: RoutedCore = { reachFor, budgets, ledger, callOn, routedText, };
 * ```
 */
export type RoutedCore = {
  /**
   * Providers that can serve one request, narrowed to vision where it carries
   * a picture.
   */
  readonly reachFor: (args: { readonly request: ForeignBorrowed<ChatTextRequest>; },) => ModelReach;

  /**
   * Shared budget view every call is routed by.
   */
  readonly budgets: ProviderBudgets;

  /**
   * In-flight slots on the providers that limit them.
   */
  readonly ledger: SlotLedger;

  /**
   * Performs one call on the named provider, releasing its slot afterwards.
   */
  readonly callOn: (args: {
    readonly provider: ProviderName;
    readonly request: ForeignBorrowed<ChatTextRequest>;
  },) => Promise<ChatTextReply>;

  /**
   * Routed free-text exchange, re-routed on budget refusals.
   */
  readonly routedText: (request: ForeignBorrowed<ChatTextRequest>,) => Promise<RoutedReply>;
};

/**
 * Other providers that also serve this call and have budget, in spending
 * order.
 *
 * @param core - what the router lent
 *
 * @param request - call that was answered badly
 *
 * @param served - provider that answered it
 *
 * @returns Providers to re-ask, empty where there is nowhere else to ask
 *
 * @example
 * ```ts
 * const [elsewhere,] = await secondOpinionsFrom({ core, request, served: 'synthetic', },);
 * ```
 */
export async function secondOpinionsFrom(
  {
    core,
    request,
    served,
  }: {
    readonly core: RoutedCore;
    readonly request: ForeignBorrowed<ChatTextRequest>;
    readonly served: ProviderName;
  },
): Promise<readonly ProviderName[]> {
  /**
   * What the router lent, named once.
   */
  const {
    reachFor,
    budgets,
  } = core;

  /**
   * Whether each provider serves this model at all, pictures included.
   */
  const reach = reachFor({ request, },);

  /**
   * The other providers, in spending order.
   */
  const others = otherProviders({ provider: served, },);

  /**
   * The other providers that serve it.
   */
  const serving = others.filter(function serves(provider,): boolean {
    return reach[provider];
  },);

  if (serving.length === 0)
    return [];

  /**
   * What each provider's budget looks like right now.
   */
  const budget = await budgets.read({ signal: request.signal, },);

  return serving.filter(function isWet(provider,): boolean {
    return !budget[provider];
  },);
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
 * @param core - what the router lent
 *
 * @param provider - stack to ask
 *
 * @param request - exchange to perform
 *
 * @returns Reply, or the named refusal when the provider was out of budget
 *
 * @example
 * ```ts
 * const asked = await replyOrBudgetRefusal({ core, provider: 'hyper', request, },);
 * ```
 */
async function replyOrBudgetRefusal(
  {
    core,
    provider,
    request,
  }: {
    readonly core: RoutedCore;
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

  /**
   * What the router lent, named once.
   */
  const {
    callOn,
    budgets,
  } = core;

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

    await budgets.markRefused({
      provider,
      signal: request.signal,
    },);
    rl.warn(`${request.modelId}: ${provider} refused the re-ask; keeping the first answer`,);
    return { kind: 'budget-refused', };
  }
}

/**
 * Schema-validated chat exchange over whichever provider served the text,
 * re-asked once elsewhere when the answer did not conform.
 *
 * @param core - what the router lent
 *
 * @param request - exchange plus content guard
 *
 * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
 *
 * @example
 * ```ts
 * const outcome = await routedJson({ core, request, },);
 * ```
 */
export async function routedJson<ValueT,>(
  {
    core,
    request,
  }: {
    readonly core: RoutedCore;
    readonly request: ForeignBorrowed<ChatJsonRequest<ValueT>>;
  },
): Promise<ChatJsonOutcome<ValueT>> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: routedJson.name,
    l,
  },);

  /**
   * What the router lent, named once.
   */
  const {
    routedText,
    ledger,
  } = core;

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
  const [elsewhere,] = await secondOpinionsFrom({
    core,
    request,
    served: provider,
  },);

  if (elsewhere === undefined)
    return outcome;

  rl.info(
    `${request.modelId}: ${outcome.kind} on ${provider}, asking ${elsewhere} for the same model`,
  );

  // THE SLOT IS TAKEN HERE FOR THE SAME REASON THE ROUTER TAKES IT AT THE
  // DECISION: `callOn` releases one slot on every call to a limiting provider,
  // and a re-ask that reached one without a take released a slot nothing
  // held, so the count drifted negative and overflow needed that many extra
  // concurrent calls before it resumed (`#240`). No `await` sits between the
  // budget read in `secondOpinionsFrom` and this line.
  ledger.take({
    provider: elsewhere,
    modelId: request.modelId,
  },);

  /**
   * Same model, same question, another serving stack; or nothing, when that
   * stack refused on budget.
   */
  const asked = await replyOrBudgetRefusal({
    core,
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

//endregion Provider router re-ask
